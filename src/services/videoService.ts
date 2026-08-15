import { VideoStatus } from '../types';

type VideoStatusListener = (status: VideoStatus) => void;
type MuteListener = (isMuted: boolean) => void;
type CameraListener = (isCameraOff: boolean) => void;
type FacingModeListener = (facingMode: 'user' | 'environment') => void;

const getRtcConfig = (): RTCConfiguration => {
  const customStun = import.meta.env.VITE_STUN_SERVERS;
  let iceServers: RTCIceServer[] = [];

  if (customStun && typeof customStun === 'string' && customStun.trim().length > 0) {
    const stunUrls = customStun.split(',').map((url) => url.trim()).filter(Boolean);
    iceServers.push({ urls: stunUrls });
  } else {
    iceServers.push(
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    );
  }

  const turnUrl = import.meta.env.VITE_TURN_SERVER_URL;
  const turnUser = import.meta.env.VITE_TURN_USERNAME;
  const turnPass = import.meta.env.VITE_TURN_CREDENTIAL;

  if (turnUrl) {
    iceServers.push({
      urls: turnUrl,
      username: turnUser,
      credential: turnPass,
    });
  }

  return { iceServers };
};

export class VideoService {
  private status: VideoStatus = 'idle';
  private isMuted = false;
  private isCameraOff = false;
  private facingMode: 'user' | 'environment' = 'user';

  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];

  private localVideoElement: HTMLVideoElement | null = null;
  private remoteVideoElement: HTMLVideoElement | null = null;

  private statusListeners: Set<VideoStatusListener> = new Set();
  private muteListeners: Set<MuteListener> = new Set();
  private cameraListeners: Set<CameraListener> = new Set();
  private facingListeners: Set<FacingModeListener> = new Set();

  public getStatus(): VideoStatus {
    return this.status;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsCameraOff(): boolean {
    return this.isCameraOff;
  }

  public getFacingMode(): 'user' | 'environment' {
    return this.facingMode;
  }

  public onStatusChange(listener: VideoStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public onMuteChange(listener: MuteListener): () => void {
    this.muteListeners.add(listener);
    listener(this.isMuted);
    return () => {
      this.muteListeners.delete(listener);
    };
  }

  public onCameraChange(listener: CameraListener): () => void {
    this.cameraListeners.add(listener);
    listener(this.isCameraOff);
    return () => {
      this.cameraListeners.delete(listener);
    };
  }

  public onFacingModeChange(listener: FacingModeListener): () => void {
    this.facingListeners.add(listener);
    listener(this.facingMode);
    return () => {
      this.facingListeners.delete(listener);
    };
  }

  private setStatus(newStatus: VideoStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((l) => l(this.status));
    }
  }

  public attachLocalVideo(element: HTMLVideoElement | null) {
    this.localVideoElement = element;
    if (element && this.localStream) {
      element.srcObject = this.localStream;
      element.play().catch(() => {});
    }
  }

  public attachRemoteVideo(element: HTMLVideoElement | null) {
    this.remoteVideoElement = element;
    if (element && this.remoteStream) {
      element.srcObject = this.remoteStream;
      element.play().catch(() => {});
    }
  }

  /**
   * Initiator starts video call
   */
  public async startVideo(
    sendSignaling: (type: string, payload?: any) => void
  ): Promise<boolean> {
    if (this.status === 'calling' || this.status === 'connecting' || this.status === 'connected') {
      return false;
    }

    this.setStatus('requesting');
    this.iceCandidateQueue = [];

    // 1. Request Camera + Microphone Access
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch (err) {
      console.warn('[VideoService] Camera/Microphone access denied or unavailable:', err);
      this.cleanup();
      this.setStatus('permission_denied');
      return false;
    }

    this.setStatus('calling');
    this.applyMediaTrackStates();

    if (this.localVideoElement && this.localStream) {
      this.localVideoElement.srcObject = this.localStream;
      this.localVideoElement.play().catch(() => {});
    }

    // 2. Setup Peer Connection
    try {
      this.createPeerConnection(sendSignaling);

      if (!this.peerConnection) {
        this.setStatus('failed');
        return false;
      }

      this.localStream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      // 3. Create & Send Offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await this.peerConnection.setLocalDescription(offer);
      sendSignaling('video_offer', { offer });
      return true;
    } catch (err) {
      console.error('[VideoService] Error creating video offer:', err);
      this.cleanup();
      this.setStatus('failed');
      return false;
    }
  }

  /**
   * Receiver handles incoming video offer
   */
  public async handleVideoOffer(
    offer: RTCSessionDescriptionInit,
    sendSignaling: (type: string, payload?: any) => void
  ): Promise<void> {
    this.cleanup();
    this.setStatus('requesting');
    this.iceCandidateQueue = [];

    // Request Media
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
    } catch (err) {
      console.warn('[VideoService] Receiver media permission denied:', err);
      sendSignaling('video_end');
      this.setStatus('permission_denied');
      return;
    }

    this.setStatus('connecting');
    this.applyMediaTrackStates();

    if (this.localVideoElement && this.localStream) {
      this.localVideoElement.srcObject = this.localStream;
      this.localVideoElement.play().catch(() => {});
    }

    try {
      this.createPeerConnection(sendSignaling);

      if (!this.peerConnection) {
        sendSignaling('video_end');
        this.setStatus('failed');
        return;
      }

      this.localStream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      await this.processIceCandidateQueue();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      sendSignaling('video_answer', { answer });
    } catch (err) {
      console.error('[VideoService] Error answering video offer:', err);
      sendSignaling('video_end');
      this.cleanup();
      this.setStatus('failed');
    }
  }

  public async handleVideoAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      if (this.peerConnection.signalingState !== 'stable') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        await this.processIceCandidateQueue();
      }
    } catch (err) {
      console.error('[VideoService] Error setting video answer description:', err);
      this.cleanup();
      this.setStatus('failed');
    }
  }

  public async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!candidate) return;

    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[VideoService] Error adding ICE candidate:', err);
      }
    } else {
      this.iceCandidateQueue.push(candidate);
    }
  }

  private async processIceCandidateQueue(): Promise<void> {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[VideoService] Error processing queued ICE candidate:', err);
        }
      }
    }
  }

  private createPeerConnection(sendSignaling: (type: string, payload?: any) => void) {
    const config = getRtcConfig();
    this.peerConnection = new RTCPeerConnection(config);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignaling('ice_candidate', { candidate: event.candidate.toJSON() });
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.remoteVideoElement) {
          this.remoteVideoElement.srcObject = this.remoteStream;
          this.remoteVideoElement.play().catch(() => {});
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;

      const state = this.peerConnection.connectionState;

      switch (state) {
        case 'connecting':
          this.setStatus('connecting');
          break;
        case 'connected':
          this.setStatus('connected');
          break;
        case 'disconnected':
          this.setStatus('ended');
          break;
        case 'failed':
          this.setStatus('failed');
          break;
        case 'closed':
          this.setStatus('idle');
          break;
      }
    };
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.applyMediaTrackStates();
    this.muteListeners.forEach((l) => l(this.isMuted));
    return this.isMuted;
  }

  public toggleCamera(): boolean {
    this.isCameraOff = !this.isCameraOff;
    this.applyMediaTrackStates();
    this.cameraListeners.forEach((l) => l(this.isCameraOff));
    return this.isCameraOff;
  }

  public async switchCamera(): Promise<void> {
    if (!this.localStream) return;

    const newFacing = this.facingMode === 'user' ? 'environment' : 'user';

    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacing } },
      });
      const newTrack = newVideoStream.getVideoTracks()[0];

      if (newTrack) {
        const oldTrack = this.localStream.getVideoTracks()[0];
        if (oldTrack) {
          this.localStream.removeTrack(oldTrack);
          oldTrack.stop();
        }

        this.localStream.addTrack(newTrack);
        this.facingMode = newFacing;
        this.facingListeners.forEach((l) => l(this.facingMode));

        // Replace track in peer connection sender if active
        if (this.peerConnection) {
          const senders = this.peerConnection.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) {
            await videoSender.replaceTrack(newTrack);
          }
        }

        if (this.localVideoElement) {
          this.localVideoElement.srcObject = this.localStream;
        }
      }
    } catch (err) {
      // Fallback try without exact constraint for desktop/laptops with single camera
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacing },
        });
        const fallbackTrack = fallbackStream.getVideoTracks()[0];
        if (fallbackTrack) {
          const oldTrack = this.localStream.getVideoTracks()[0];
          if (oldTrack) {
            this.localStream.removeTrack(oldTrack);
            oldTrack.stop();
          }
          this.localStream.addTrack(fallbackTrack);
          this.facingMode = newFacing;
          this.facingListeners.forEach((l) => l(this.facingMode));

          if (this.peerConnection) {
            const senders = this.peerConnection.getSenders();
            const videoSender = senders.find((s) => s.track?.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(fallbackTrack);
            }
          }

          if (this.localVideoElement) {
            this.localVideoElement.srcObject = this.localStream;
          }
        }
      } catch (fallbackErr) {
        console.warn('[VideoService] Cannot switch camera on single-camera device:', fallbackErr);
      }
    }
  }

  private applyMediaTrackStates() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !this.isCameraOff;
      });
    }
  }

  public handleVideoEnd() {
    this.cleanup();
    this.setStatus('ended');
  }

  public endVideo(sendSignaling?: (type: string, payload?: any) => void) {
    if (sendSignaling && (this.status === 'calling' || this.status === 'connecting' || this.status === 'connected' || this.status === 'requesting')) {
      try {
        sendSignaling('video_end');
      } catch (e) {
        // Safe fallback
      }
    }
    this.cleanup();
    this.setStatus('idle');
  }

  public destroy() {
    this.cleanup();
    this.statusListeners.clear();
    this.muteListeners.clear();
    this.cameraListeners.clear();
    this.facingListeners.clear();
  }

  private cleanup() {
    // 1. Release hardware media tracks completely
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.remoteStream = null;
    }

    // 2. Close peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.onicecandidate = null;
        this.peerConnection.ontrack = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
    }

    // 3. Clear video element sources
    if (this.localVideoElement) {
      this.localVideoElement.srcObject = null;
    }
    if (this.remoteVideoElement) {
      this.remoteVideoElement.srcObject = null;
    }

    this.iceCandidateQueue = [];
  }
}

export const videoService = new VideoService();

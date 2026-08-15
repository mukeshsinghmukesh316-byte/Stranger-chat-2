import { VoiceStatus } from '../types';

type VoiceStatusListener = (status: VoiceStatus) => void;
type MuteListener = (isMuted: boolean) => void;

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

  // Optional production TURN server setup via environment variables
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

export class VoiceService {
  private status: VoiceStatus = 'idle';
  private isMuted = false;

  private localStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private iceCandidateQueue: RTCIceCandidateInit[] = [];

  private statusListeners: Set<VoiceStatusListener> = new Set();
  private muteListeners: Set<MuteListener> = new Set();

  constructor() {
    this.initAudioElement();
  }

  private initAudioElement() {
    if (typeof document !== 'undefined') {
      const existing = document.getElementById('strangerchat-remote-audio') as HTMLAudioElement;
      if (existing) {
        this.remoteAudioElement = existing;
      } else {
        const audio = document.createElement('audio');
        audio.id = 'strangerchat-remote-audio';
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        audio.style.display = 'none';
        document.body.appendChild(audio);
        this.remoteAudioElement = audio;
      }
    }
  }

  public getStatus(): VoiceStatus {
    return this.status;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public onStatusChange(listener: VoiceStatusListener): () => void {
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

  private setStatus(newStatus: VoiceStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => listener(this.status));
    }
  }

  /**
   * User A initiates voice call:
   * 1. Request microphone permission
   * 2. Setup RTCPeerConnection & local audio tracks
   * 3. Create & send offer via WebRTC signaling
   */
  public async startVoice(
    sendSignaling: (type: string, payload?: any) => void
  ): Promise<boolean> {
    if (this.status === 'calling' || this.status === 'connecting' || this.status === 'connected') {
      return false;
    }

    this.setStatus('calling');
    this.iceCandidateQueue = [];

    // 1. Request Microphone Access
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (err: any) {
      console.warn('[VoiceService] Microphone access denied or unavailable:', err);
      this.cleanup();
      this.setStatus('permission_denied');
      return false;
    }

    // Apply current mute state to fresh stream
    this.applyMuteState();

    // 2. Initialize PeerConnection
    try {
      this.createPeerConnection(sendSignaling);

      if (!this.peerConnection) {
        this.setStatus('failed');
        return false;
      }

      // Add local audio tracks
      this.localStream.getAudioTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      // 3. Create & Set Offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
      });

      await this.peerConnection.setLocalDescription(offer);

      // Send offer through WebSocket signaling
      sendSignaling('voice_offer', { offer });
      return true;
    } catch (err) {
      console.error('[VoiceService] Error creating voice offer:', err);
      this.cleanup();
      this.setStatus('failed');
      return false;
    }
  }

  /**
   * User B receives voice offer from User A:
   * 1. Request microphone permission
   * 2. Setup RTCPeerConnection & tracks
   * 3. Set remote offer & create answer
   */
  public async handleVoiceOffer(
    offer: RTCSessionDescriptionInit,
    sendSignaling: (type: string, payload?: any) => void
  ): Promise<void> {
    // If already in an active session, reset previous
    this.cleanup();
    this.setStatus('connecting');
    this.iceCandidateQueue = [];

    // 1. Request Microphone Access
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (err) {
      console.warn('[VoiceService] User B mic access denied upon offer:', err);
      sendSignaling('voice_end');
      this.setStatus('permission_denied');
      return;
    }

    this.applyMuteState();

    // 2. Setup Peer Connection
    try {
      this.createPeerConnection(sendSignaling);

      if (!this.peerConnection) {
        sendSignaling('voice_end');
        this.setStatus('failed');
        return;
      }

      // Add local audio track
      this.localStream.getAudioTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });

      // Set Remote Description (Offer)
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Drain queued ICE candidates
      await this.processIceCandidateQueue();

      // Create Answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Send Answer through signaling
      sendSignaling('voice_answer', { answer });
    } catch (err) {
      console.error('[VoiceService] Error handling voice offer:', err);
      sendSignaling('voice_end');
      this.cleanup();
      this.setStatus('failed');
    }
  }

  /**
   * User A receives voice answer from User B
   */
  public async handleVoiceAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;

    try {
      if (this.peerConnection.signalingState !== 'stable') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        await this.processIceCandidateQueue();
      }
    } catch (err) {
      console.error('[VoiceService] Error setting remote answer description:', err);
      this.cleanup();
      this.setStatus('failed');
    }
  }

  /**
   * Process ICE Candidate received from partner
   */
  public async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!candidate) return;

    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[VoiceService] Error adding ICE candidate:', err);
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
          console.warn('[VoiceService] Error processing queued ICE candidate:', err);
        }
      }
    }
  }

  private createPeerConnection(sendSignaling: (type: string, payload?: any) => void) {
    const config = getRtcConfig();
    this.peerConnection = new RTCPeerConnection(config);

    // Send ICE candidates to partner
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignaling('ice_candidate', { candidate: event.candidate.toJSON() });
      }
    };

    // Attach incoming remote audio stream to HTML5 audio element
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.attachRemoteStream(event.streams[0]);
      }
    };

    // Monitor WebRTC Connection State
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
          this.setStatus('disconnected');
          break;
        case 'failed':
          this.setStatus('failed');
          break;
        case 'closed':
          this.setStatus('idle');
          break;
        default:
          break;
      }
    };
  }

  private attachRemoteStream(stream: MediaStream) {
    if (!this.remoteAudioElement) {
      this.initAudioElement();
    }
    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = stream;
      this.remoteAudioElement.play().catch((err) => {
        console.warn('[VoiceService] Auto-play prevented by browser policy:', err);
      });
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.applyMuteState();
    this.muteListeners.forEach((listener) => listener(this.isMuted));
    return this.isMuted;
  }

  private applyMuteState() {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
  }

  /**
   * Handle 'voice_end' event from stranger
   */
  public handleVoiceEnd() {
    this.cleanup();
    this.setStatus('disconnected');
  }

  /**
   * Explicitly end or cancel voice call
   */
  public endVoice(sendSignaling?: (type: string, payload?: any) => void) {
    if (sendSignaling && (this.status === 'calling' || this.status === 'connecting' || this.status === 'connected')) {
      try {
        sendSignaling('voice_end');
      } catch (e) {
        // Safe fallback
      }
    }
    this.cleanup();
    this.setStatus('idle');
  }

  /**
   * Complete lifecycle tear down when chat ends (Next, Block, Disconnect, WS Close)
   */
  public destroy() {
    this.cleanup();
    this.statusListeners.clear();
    this.muteListeners.clear();
  }

  private cleanup() {
    // 1. Stop local audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      this.localStream = null;
    }

    // 2. Close peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.onicecandidate = null;
        this.peerConnection.ontrack = null;
        this.peerConnection.onconnectionstatechange = null;
        this.peerConnection.close();
      } catch (e) {
        // ignore
      }
      this.peerConnection = null;
    }

    // 3. Clear remote audio stream
    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = null;
    }

    this.iceCandidateQueue = [];
  }
}

export const voiceService = new VoiceService();

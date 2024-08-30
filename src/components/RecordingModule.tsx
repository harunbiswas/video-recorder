import React, { useEffect, useRef, useState } from "react";

const RecordingModule: React.FC = () => {
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [recordingTime, setRecordingTime] = useState<number>(0); // Elapsed recording time
  const [volume, setVolume] = useState<number>(0); // Microphone volume
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");
  const [recording, setRecording] = useState(false);
  const [videoSrc, setVideoSrc] = useState("");
  const [isSubmit, setIsSubmit] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<Blob | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunks: BlobPart[] = [];

  useEffect(() => {
    if (mediaStream) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoDevices = devices.filter(
          (device) => device.kind === "videoinput"
        );
        const audioDevices = devices.filter(
          (device) => device.kind === "audioinput"
        );
        setVideoDevices(videoDevices);
        setAudioDevices(audioDevices);

        // Set default devices

        if (videoDevices.length)
          setSelectedVideoDevice(
            selectedVideoDevice || videoDevices[0].deviceId
          );
        if (audioDevices.length)
          setSelectedAudioDevice(
            selectedAudioDevice || audioDevices[0].deviceId
          );
      });
    } else {
      setAudioDevices([]);
      setVideoDevices([]);
    }
  }, [mediaStream]);

  useEffect(() => {
    if (mediaStream) {
      setupAudioProcessing(mediaStream);
    }
  }, [mediaStream]);

  useEffect(() => {
    if (selectedAudioDevice && selectedVideoDevice && mediaStream) {
      handlePermission();
    }
  }, [selectedVideoDevice, selectedAudioDevice]);

  const handlePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: selectedVideoDevice },
        audio: { deviceId: selectedAudioDevice },
      });

      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Permission denied", err);
    }
  };

  const denyMediaPermissions = async () => {
    // Stop all media tracks
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setRecording(false);
    setRecordingTime(0);

    // Close audio context if it exists
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setMediaStream(null); // Clear media stream state
  };

  const handleDeviceChange = async () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null); // Clear media stream state
    }
    stopRecording();
    await handlePermission(); // Restart with new devices
  };

  const setupAudioProcessing = (stream: MediaStream) => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);
    analyserRef.current = analyser;

    const updateVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      const sum = dataArray.reduce((a, b) => a + b, 0);
      const average = sum / dataArray.length;
      setVolume(average);
      requestAnimationFrame(updateVolume);
    };
    updateVolume();
  };

  const startRecording = () => {
    setCountdown(3);

    if (mediaStream) {
      mediaRecorderRef.current = new MediaRecorder(mediaStream);
      mediaRecorderRef.current.ondataavailable = (event) =>
        chunks.push(event.data);
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        setRecordedVideo(blob);
        chunks.length = 0; // Clear chunks
      };

      setTimeout(() => {
        // Start recording timer
        setRecordingTime(0);
        setInterval(() => {
          setRecordingTime((prevTime) => prevTime + 1);
        }, 1000); // Update every second
        mediaRecorderRef.current?.start();
        setRecording(true);
      }, 3000);
    }
  };

  useEffect(() => {
    if (countdown <= 0) {
      // Countdown has finished

      return;
    }

    const interval = setInterval(() => {
      setCountdown((prevCountdown) => prevCountdown - 1);
    }, 1000);

    // Clear interval on component unmount or when countdown changes
    return () => clearInterval(interval);
  }, [countdown]);

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setRecordingTime(0);
  };

  const handleSubmit = () => {
    if (recordedVideo) {
      stopRecording();
      setIsSubmit(true);
      denyMediaPermissions();
      // Here you can handle the recorded video (e.g., upload it to a server)
      console.log("Recorded video saved:", recordedVideo);
    }
  };

  useEffect(() => {
    let videoURL: string | null = null;

    if (recordedVideo) {
      videoURL = URL.createObjectURL(recordedVideo);
      setVideoSrc(videoURL);
    }

    return () => {
      if (videoURL) {
        URL.revokeObjectURL(videoURL); // Cleanup the URL when the component unmounts
      }
    };
  }, [recordedVideo]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const paddedHrs = hrs.toString().padStart(2, "0");
    const paddedMins = mins.toString().padStart(2, "0");
    const paddedSecs = secs.toString().padStart(2, "0");

    return `${paddedHrs}:${paddedMins}:${paddedSecs}`;
  };

  return (
    <div className="p-4 min-h-screen">
      <div className="mt-4 border-red-300 border-4 w-1/2 h-1/2 mx-auto relative rounded">
        {!mediaStream && (
          <div className=" absolute w-auto h-auto top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <button
              onClick={handlePermission}
              className="bg-blue-500 text-white p-2 rounded cursor-pointer"
            >
              Ask Permission
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full"
        ></video>

        {recording && (
          <div className="absolute bottom-0 bg-white w-full p-1 flex items-center justify-between">
            <div>{recording && formatTime(recordingTime)}</div>
            <div className="flex items-center gap-2">
              <strong>Mic:</strong>
              <div className="bg-black h-2 w-24 rounded overflow-hidden relative">
                <div
                  className={`h-full  bg-red-500 absolute left-0 top-0`}
                  style={{ width: `${volume}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {(countdown && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 ">
            <h1 className="text-white text-5xl">{countdown}</h1>
          </div>
        )) ||
          null}
      </div>
      <div className="w-1/2 mx-auto flex justify-between items-center">
        <div className="mt-4 flex flex-col gap-2">
          <label>Video Source: </label>
          <select
            value={selectedVideoDevice}
            onChange={(e) => {
              setSelectedVideoDevice(e.target.value);
              handleDeviceChange();
            }}
          >
            {(videoDevices.length > 0 &&
              videoDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))) || <option>Select Camera</option>}
          </select>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <label>Audio Source: </label>
          <select
            value={selectedAudioDevice}
            onChange={(e) => {
              setSelectedAudioDevice(e.target.value);
              handleDeviceChange();
            }}
          >
            {(audioDevices.length > 0 &&
              audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))) || <option>Select Microphone</option>}
          </select>
        </div>
      </div>

      {mediaStream && (
        <div className="">
          <div className="mt-8 flex justify-center items-center">
            <button
              onClick={(!recording && startRecording) || stopRecording}
              className={`${
                (!recording && "bg-green-500") || "bg-red-500"
              } text-white p-2 rounded cursor-pointer`}
            >
              {(!recording && "Start Recording") || "Stop Recording"}
            </button>
          </div>
          <div className="mt-4 flex justify-center items-center">
            <button
              onClick={handleSubmit}
              className="bg-gray-500 text-white p-2 rounded"
            >
              Submit Video
            </button>
          </div>
        </div>
      )}
      {isSubmit && recordedVideo && (
        <div className="mt-4 w-1/2 mx-auto h-auto">
          <h3>Recorded Video:</h3>
          <video controls src={videoSrc} className="w-full h-auto"></video>
        </div>
      )}
    </div>
  );
};

export default RecordingModule;

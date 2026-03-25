function setAudioTarget(context, param, value, timeConstant = 0.9) {
  if (!context || !param) {
    return;
  }

  param.cancelScheduledValues(context.currentTime);
  param.setTargetAtTime(value, context.currentTime, timeConstant);
}

function createImpulseResponse(context, durationSeconds = 3.4, decay = 2.8) {
  const sampleRate = context.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const impulse = context.createBuffer(2, frameCount, sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const channelData = impulse.getChannelData(channel);

    for (let index = 0; index < frameCount; index += 1) {
      const decayEnvelope = Math.pow(1 - index / frameCount, decay);
      channelData[index] = (Math.random() * 2 - 1) * decayEnvelope * 0.55;
    }
  }

  return impulse;
}

function createNoiseBuffer(context, durationSeconds = 2.6) {
  const sampleRate = context.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const noise = context.createBuffer(1, frameCount, sampleRate);
  const data = noise.getChannelData(0);
  let lastValue = 0;

  for (let index = 0; index < frameCount; index += 1) {
    const white = Math.random() * 2 - 1;
    lastValue = (lastValue + 0.028 * white) / 1.028;
    data[index] = lastValue * 3.1;
  }

  return noise;
}

export function createAmbientScore() {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  const context = new AudioContextClass();
  const output = context.createGain();
  const toneBus = context.createGain();
  const dryGain = context.createGain();
  const wetGain = context.createGain();
  const lowpass = context.createBiquadFilter();
  const highpass = context.createBiquadFilter();
  const compressor = context.createDynamicsCompressor();
  const convolver = context.createConvolver();
  const startedNodes = [];

  output.gain.value = 0.0001;
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 1700;
  lowpass.Q.value = 0.22;
  highpass.type = 'highpass';
  highpass.frequency.value = 58;
  highpass.Q.value = 0.26;
  dryGain.gain.value = 0.88;
  wetGain.gain.value = 0.34;
  compressor.threshold.value = -24;
  compressor.knee.value = 24;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.08;
  compressor.release.value = 0.42;
  convolver.buffer = createImpulseResponse(context);

  toneBus.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(dryGain);
  lowpass.connect(convolver);
  convolver.connect(wetGain);
  dryGain.connect(compressor);
  wetGain.connect(compressor);
  compressor.connect(output);
  output.connect(context.destination);

  const droneDefinitions = [
    { frequency: 73.42, gain: 0.021, type: 'triangle', detune: -6 },
    { frequency: 110.0, gain: 0.013, type: 'sine', detune: 4 },
    { frequency: 146.83, gain: 0.009, type: 'triangle', detune: -2 },
    { frequency: 220.0, gain: 0.0045, type: 'sine', detune: 3 },
  ];

  droneDefinitions.forEach((definition) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = definition.type;
    oscillator.frequency.value = definition.frequency;
    oscillator.detune.value = definition.detune;
    gain.gain.value = definition.gain;

    oscillator.connect(gain);
    gain.connect(toneBus);
    oscillator.start();

    startedNodes.push(oscillator);
  });

  const shimmerOscillator = context.createOscillator();
  const shimmerFilter = context.createBiquadFilter();
  const shimmerGain = context.createGain();
  const shimmerLfo = context.createOscillator();
  const shimmerDepth = context.createGain();

  shimmerOscillator.type = 'triangle';
  shimmerOscillator.frequency.value = 293.66;
  shimmerFilter.type = 'bandpass';
  shimmerFilter.frequency.value = 920;
  shimmerFilter.Q.value = 0.7;
  shimmerGain.gain.value = 0.0034;
  shimmerLfo.type = 'sine';
  shimmerLfo.frequency.value = 0.061;
  shimmerDepth.gain.value = 0.0024;

  shimmerOscillator.connect(shimmerFilter);
  shimmerFilter.connect(shimmerGain);
  shimmerGain.connect(toneBus);
  shimmerLfo.connect(shimmerDepth);
  shimmerDepth.connect(shimmerGain.gain);

  shimmerOscillator.start();
  shimmerLfo.start();
  startedNodes.push(shimmerOscillator, shimmerLfo);

  const pulseOscillator = context.createOscillator();
  const pulseFilter = context.createBiquadFilter();
  const pulseGain = context.createGain();
  const pulseLfo = context.createOscillator();
  const pulseDepth = context.createGain();

  pulseOscillator.type = 'triangle';
  pulseOscillator.frequency.value = 196.0;
  pulseOscillator.detune.value = 7;
  pulseFilter.type = 'lowpass';
  pulseFilter.frequency.value = 540;
  pulseGain.gain.value = 0.0028;
  pulseLfo.type = 'triangle';
  pulseLfo.frequency.value = 0.12;
  pulseDepth.gain.value = 0.0023;

  pulseOscillator.connect(pulseFilter);
  pulseFilter.connect(pulseGain);
  pulseGain.connect(toneBus);
  pulseLfo.connect(pulseDepth);
  pulseDepth.connect(pulseGain.gain);

  pulseOscillator.start();
  pulseLfo.start();
  startedNodes.push(pulseOscillator, pulseLfo);

  const boomOscillator = context.createOscillator();
  const boomGain = context.createGain();
  const boomLfo = context.createOscillator();
  const boomDepth = context.createGain();

  boomOscillator.type = 'sine';
  boomOscillator.frequency.value = 55;
  boomGain.gain.value = 0.0055;
  boomLfo.type = 'sine';
  boomLfo.frequency.value = 0.032;
  boomDepth.gain.value = 0.0036;

  boomOscillator.connect(boomGain);
  boomGain.connect(toneBus);
  boomLfo.connect(boomDepth);
  boomDepth.connect(boomGain.gain);

  boomOscillator.start();
  boomLfo.start();
  startedNodes.push(boomOscillator, boomLfo);

  const airSource = context.createBufferSource();
  const airFilter = context.createBiquadFilter();
  const airGain = context.createGain();
  const airLfo = context.createOscillator();
  const airDepth = context.createGain();

  airSource.buffer = createNoiseBuffer(context);
  airSource.loop = true;
  airFilter.type = 'bandpass';
  airFilter.frequency.value = 760;
  airFilter.Q.value = 0.28;
  airGain.gain.value = 0.0016;
  airLfo.type = 'sine';
  airLfo.frequency.value = 0.043;
  airDepth.gain.value = 0.0011;

  airSource.connect(airFilter);
  airFilter.connect(airGain);
  airGain.connect(toneBus);
  airLfo.connect(airDepth);
  airDepth.connect(airGain.gain);

  airSource.start();
  airLfo.start();
  startedNodes.push(airSource, airLfo);

  function setIntensity(state = 'landing') {
    const nextGain =
      state === 'ducked' ? 0.038 :
      state === 'conjuring' ? 0.128 :
      state === 'idle' ? 0.115 :
      state === 'tail' ? 0.058 :
      0.094;

    const nextWetGain =
      state === 'ducked' ? 0.18 :
      state === 'conjuring' ? 0.46 :
      state === 'idle' ? 0.38 :
      state === 'tail' ? 0.26 :
      0.31;

    setAudioTarget(
      context,
      output.gain,
      nextGain,
      state === 'ducked' ? 0.22 : 1.3,
    );
    setAudioTarget(
      context,
      wetGain.gain,
      nextWetGain,
      state === 'ducked' ? 0.28 : 1.7,
    );
  }

  return {
    context,
    async resume() {
      if (context.state !== 'running') {
        await context.resume();
      }
    },
    setIntensity,
    stop() {
      setIntensity('tail');
      startedNodes.forEach((node) => {
        try {
          node.stop(context.currentTime + 0.22);
        } catch (_error) {
          // Node may already be stopped.
        }
      });
      setTimeout(() => {
        context.close().catch(() => {});
      }, 260);
    },
  };
}

function setAudioTarget(context, param, value, timeConstant = 0.9) {
  if (!context || !param) {
    return;
  }

  param.cancelScheduledValues(context.currentTime);
  param.setTargetAtTime(value, context.currentTime, timeConstant);
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
  const lowpass = context.createBiquadFilter();
  const highpass = context.createBiquadFilter();
  const startedNodes = [];

  output.gain.value = 0.0001;
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 980;
  lowpass.Q.value = 0.15;
  highpass.type = 'highpass';
  highpass.frequency.value = 72;
  highpass.Q.value = 0.2;

  toneBus.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(output);
  output.connect(context.destination);

  const droneDefinitions = [
    { frequency: 82.41, gain: 0.012, type: 'triangle', detune: -4 },
    { frequency: 123.47, gain: 0.008, type: 'sine', detune: 3 },
    { frequency: 164.81, gain: 0.004, type: 'sine', detune: -2 },
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

  shimmerOscillator.type = 'sine';
  shimmerOscillator.frequency.value = 246.94;
  shimmerFilter.type = 'highpass';
  shimmerFilter.frequency.value = 180;
  shimmerGain.gain.value = 0.0011;
  shimmerLfo.type = 'sine';
  shimmerLfo.frequency.value = 0.08;
  shimmerDepth.gain.value = 0.0007;

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
  pulseOscillator.frequency.value = 164.81;
  pulseOscillator.detune.value = 6;
  pulseFilter.type = 'lowpass';
  pulseFilter.frequency.value = 320;
  pulseGain.gain.value = 0.001;
  pulseLfo.type = 'triangle';
  pulseLfo.frequency.value = 0.17;
  pulseDepth.gain.value = 0.0008;

  pulseOscillator.connect(pulseFilter);
  pulseFilter.connect(pulseGain);
  pulseGain.connect(toneBus);
  pulseLfo.connect(pulseDepth);
  pulseDepth.connect(pulseGain.gain);

  pulseOscillator.start();
  pulseLfo.start();
  startedNodes.push(pulseOscillator, pulseLfo);

  function setIntensity(state = 'landing') {
    const nextGain =
      state === 'ducked' ? 0.01 :
      state === 'conjuring' ? 0.028 :
      state === 'idle' ? 0.033 :
      state === 'tail' ? 0.018 :
      0.024;

    setAudioTarget(
      context,
      output.gain,
      nextGain,
      state === 'ducked' ? 0.22 : 1.3,
    );
  }

  return {
    context,
    async resume() {
      if (context.state === 'suspended') {
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

// Short waveform-aligned overlap/add keeps the HAA's pitch as its length varies.
export function stretchVoice(input,length,sampleRate) {
  length=Math.max(1,Math.round(length));
  const output=new Float32Array(length),weights=new Float32Array(length);
  const window=Math.min(input.length,Math.round(sampleRate*.04)),hop=Math.max(1,Math.round(window/4)),search=Math.round(sampleRate*.008);
  if(window<8)return Float32Array.from({length},(_,i)=>input[Math.min(input.length-1,Math.floor(i*input.length/length))]||0);
  for(let at=0;at<length;at+=hop) {
    const expected=Math.min(input.length-window,Math.round(at/Math.max(1,length-window)*(input.length-window)));
    let source=expected,best=-Infinity;
    if(at>0)for(let candidate=Math.max(0,expected-search);candidate<=Math.min(input.length-window,expected+search);candidate+=8) {
      let dot=0,norm=0;
      for(let j=0;j<window-hop&&at+j<length;j+=16)if(weights[at+j]>.01){const a=output[at+j]/weights[at+j],b=input[candidate+j];dot+=a*b;norm+=b*b;}
      const score=dot/Math.sqrt(norm+1e-12);if(score>best){best=score;source=candidate;}
    }
    for(let j=0;j<window&&at+j<length;j++) {
      const weight=.5-.5*Math.cos(2*Math.PI*j/(window-1));
      output[at+j]+=input[source+j]*weight;weights[at+j]+=weight;
    }
  }
  const fade=Math.max(1,Math.round(sampleRate*.008));
  for(let i=0;i<length;i++)output[i]=weights[i]>.001?output[i]/weights[i]*Math.min(1,i/fade,(length-1-i)/fade):0;
  output[0]=0;output[length-1]=0;
  return output;
}

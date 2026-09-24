import {CARD_REDEAL,GAIN_MS} from './card-motion.mjs';

// Card handling only. The separate attribute/story bank remains silent.
export class CardAudio {
  enabled=true;context=null;raw={};buffers={};sources=new Set();generation=0;
  prepare(){
    if(!this.enabled)return Promise.resolve();
    return this.loading??=Promise.all(['arrival','withdrawal'].map(async cue=>{
      try{const response=await fetch(new URL(`./sounds/cards/${cue}.wav`,import.meta.url));if(response.ok)this.raw[cue]=await response.arrayBuffer();}catch{}
    }));
  }
  unlock(){
    if(!this.enabled)return;
    try{
      this.context??=new (window.AudioContext||window.webkitAudioContext)();
      this.resuming=this.context.resume().catch(()=>{});
      this.decoding??=this.prepare().then(()=>Promise.all(Object.entries(this.raw).map(async([cue,data])=>{
        try{this.buffers[cue]=await this.context.decodeAudioData(data);}catch{}
      })));
    }catch{}
  }
  async transition({outgoing=0,incoming=0,startedAt,reduced=false}){
    if(!this.enabled||!this.context||!outgoing&&!incoming)return;
    const generation=this.generation;
    await this.decoding;await this.resuming;
    if(!this.enabled||generation!==this.generation||this.context.state!=='running')return;
    const elapsed=Math.max(0,(performance.now()-startedAt)/1000);
    const total=(reduced?180:GAIN_MS)/1000;
    for(const [cue,count,at,end] of [
      ['withdrawal',outgoing,0,reduced?total:CARD_REDEAL/1000],
      ['arrival',incoming,reduced?0:CARD_REDEAL/1000,total],
    ]){
      const buffer=this.buffers[cue];if(!count||!buffer||elapsed>=end)continue;
      const offset=Math.max(0,elapsed-at),duration=Math.min(buffer.duration-offset,end-Math.max(elapsed,at));
      if(duration<=0)continue;
      const context=this.context,time=context.currentTime+Math.max(0,at-elapsed),source=context.createBufferSource(),gain=context.createGain();
      source.buffer=buffer;gain.gain.setValueAtTime(.42,time);
      gain.gain.setValueAtTime(.42,time+Math.max(0,duration-.025));gain.gain.linearRampToValueAtTime(0,time+duration);
      source.connect(gain).connect(context.destination);this.sources.add(source);
      source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();};
      source.start(time,offset,duration);
    }
  }
  cancel(){this.generation++;for(const source of this.sources){try{source.stop();}catch{}source.disconnect();}this.sources.clear();}
  stop(){this.cancel();this.context?.suspend().catch(()=>{});}
  setEnabled(value){this.enabled=!!value;if(!this.enabled)this.stop();else this.prepare();}
}

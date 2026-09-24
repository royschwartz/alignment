import {cardSoundTimeline} from './card-motion.mjs?v=1.4.10';

// Card handling only. The separate attribute/story bank remains silent.
export class CardAudio {
  enabled=true;context=null;raw={};buffers={};sources=new Set();generation=0;
  prepare(){
    if(!this.enabled)return Promise.resolve();
    return this.loading??=Promise.all(['arrival','withdrawal','disintegration'].map(async cue=>{
      try{const response=await fetch(new URL(`./sounds/cards/${cue}.wav?v=1.4.10`,import.meta.url));if(response.ok)this.raw[cue]=await response.arrayBuffer();}catch{}
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
  async transition({outgoing=[],incoming=[],selected,transfers=[],hasHand=false,startedAt,reduced=false}){
    if(!this.enabled||!this.context||!outgoing.length&&!incoming.length)return;
    const generation=this.generation;
    await this.decoding;await this.resuming;
    if(!this.enabled||generation!==this.generation||this.context.state!=='running')return;
    const elapsed=Math.max(0,(performance.now()-startedAt)/1000);
    const origin=this.context.currentTime-elapsed;
    for(const event of cardSoundTimeline({outgoing,incoming,selected,transfers,hasHand,reduced})){
      const {cue}=event,at=event.start/1000,end=event.end/1000;
      const buffer=this.buffers[cue];if(!buffer||elapsed>=end)continue;
      const offset=Math.max(0,elapsed-at),duration=Math.min(buffer.duration-offset,end-Math.max(elapsed,at));
      if(duration<=0)continue;
      const context=this.context,time=origin+Math.max(elapsed,at),source=context.createBufferSource(),gain=context.createGain();
      const level={arrival:.32,withdrawal:.28,disintegration:.36}[cue];
      source.buffer=buffer;gain.gain.setValueAtTime(0,time);
      gain.gain.linearRampToValueAtTime(level,time+Math.min(.005,duration/3));
      gain.gain.setValueAtTime(level,time+Math.max(duration/3,duration-.025));gain.gain.linearRampToValueAtTime(0,time+duration);
      source.connect(gain).connect(context.destination);this.sources.add(source);
      source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();};
      source.start(time,offset,duration);
    }
  }
  cancel(){this.generation++;for(const source of this.sources){try{source.stop();}catch{}source.disconnect();}this.sources.clear();}
  stop(){this.cancel();this.context?.suspend().catch(()=>{});}
  setEnabled(value){this.enabled=!!value;if(!this.enabled)this.stop();else this.prepare();}
}

import {cardSoundTimeline} from './card-motion.mjs?v=1.4.11';
export const CARD_ARRIVAL_SOUNDS=['arrival','arrival-2','arrival-3','arrival-4'];

// Dry PC-speaker card cues and the original reading click. Attribute/story audio stays silent.
export class CardAudio {
  constructor({random=Math.random}={}){this.random=random;}
  enabled=true;context=null;raw={};buffers={};sources=new Set();generation=0;
  prepare(){
    if(!this.enabled)return Promise.resolve();
    return this.loading??=Promise.all([...CARD_ARRIVAL_SOUNDS,'withdrawal','disintegration','click'].map(async cue=>{
      try{const response=await fetch(new URL(`./sounds/pc/${cue}.wav?v=pc-3`,import.meta.url));if(response.ok)this.raw[cue]=await response.arrayBuffer();}catch{}
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
  async transition({outgoing=[],incoming=[],selected,transfers=[],hasHand=false,startedAt,reduced=false,clicked=false}){
    if(!this.enabled||!this.context||!clicked&&!outgoing.length&&!incoming.length)return;
    const generation=this.generation;
    await this.decoding;await this.resuming;
    if(!this.enabled||generation!==this.generation||this.context.state!=='running')return;
    const elapsed=Math.max(0,(performance.now()-startedAt)/1000);
    const origin=this.context.currentTime-elapsed;
    const events=cardSoundTimeline({outgoing,incoming,selected,transfers,hasHand,reduced});
    // Selected cards already use the original click as their disappearance cue.
    // Reading gets one click, without doubling a selection or sounding on reload.
    if(clicked&&!events.some(event=>event.cue==='disintegration'))events.unshift({cue:'click',start:0,end:80});
    for(const event of events){
      const {cue}=event,at=event.start/1000,end=event.end/1000;
      // Cosmetic randomness only: each arriving card picks a nearby low tone,
      // independently of its position and the saved gameplay random seed.
      const sound=cue==='arrival'?CARD_ARRIVAL_SOUNDS[Math.min(CARD_ARRIVAL_SOUNDS.length-1,Math.floor(this.random()*CARD_ARRIVAL_SOUNDS.length))]:cue;
      const buffer=this.buffers[sound]||this.buffers[cue];if(!buffer||elapsed>=end)continue;
      // A short reading click needs its attack. Allow setup within the 80 ms
      // gesture window, then discard it rather than playing stale feedback.
      const offset=cue==='click'?0:Math.max(0,elapsed-at),duration=Math.min(buffer.duration-offset,end-Math.max(elapsed,at));
      if(duration<=0)continue;
      const context=this.context,time=origin+Math.max(elapsed,at),source=context.createBufferSource(),gain=context.createGain();
      // The WAVs contain the original quiet envelope and level already.
      const level=1;
      source.buffer=buffer;gain.gain.setValueAtTime(0,time);
      gain.gain.linearRampToValueAtTime(level,time+Math.min(.001,duration/3));
      gain.gain.setValueAtTime(level,time+Math.max(duration/3,duration-.002));gain.gain.linearRampToValueAtTime(0,time+duration);
      source.connect(gain).connect(context.destination);this.sources.add(source);
      source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();};
      source.start(time,offset,duration);
    }
  }
  cancel(){this.generation++;for(const source of this.sources){try{source.stop();}catch{}source.disconnect();}this.sources.clear();}
  stop(){this.cancel();this.context?.suspend().catch(()=>{});}
  setEnabled(value){this.enabled=!!value;if(!this.enabled)this.stop();else this.prepare();}
}

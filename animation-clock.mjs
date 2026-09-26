// One adjustable cadence for presentation. Game time and audio never use it.
export const DEFAULT_ANIMATION_FPS=12;
export function normalizeAnimationFPS(value){
  if(value==null||value==='')return DEFAULT_ANIMATION_FPS;
  const number=Number(value);
  return Number.isFinite(number)?Math.max(1,Math.min(60,Math.round(number))):DEFAULT_ANIMATION_FPS;
}

export class AnimationClock {
  constructor({fps=DEFAULT_ANIMATION_FPS,requestFrame=callback=>requestAnimationFrame(callback),cancelFrame=id=>cancelAnimationFrame(id)}={}){
    this.requestFrame=requestFrame;this.cancelFrame=cancelFrame;this.pending=new Map();this.id=0;this.frame=null;this.next=null;this.setFPS(fps);
  }
  setFPS(value){this.fps=normalizeAnimationFPS(value);this.interval=1000/this.fps;this.next=null;return this.fps;}
  request(callback){const id=++this.id;this.pending.set(id,callback);this.schedule();return id;}
  cancel(id){
    this.pending.delete(id);
    if(!this.pending.size&&this.frame!==null){this.cancelFrame(this.frame);this.frame=null;}
  }
  schedule(){if(this.frame===null&&this.pending.size)this.frame=this.requestFrame(time=>this.tick(time));}
  tick(time){
    this.frame=null;
    if(this.next===null)this.next=time;
    if(time+.01>=this.next){
      const skipped=Math.max(0,Math.floor((time-this.next+.01)/this.interval));
      const sampled=this.next+skipped*this.interval;this.next=sampled+this.interval;
      const callbacks=[...this.pending.values()];this.pending.clear();
      for(const callback of callbacks)callback(Math.min(time,sampled));
    }
    this.schedule();
  }
}

export const animationClock=new AnimationClock();
export const requestAnimationTick=callback=>animationClock.request(callback);
export const cancelAnimationTick=id=>animationClock.cancel(id);

// Initial and final stills are immediate. Intermediate frames use the selected
// cadence. A deadline keeps a 1 FPS setting from stretching an 860 ms effect.
export function animateFrames({duration,draw,startedAt,now=()=>performance.now(),isCurrent=()=>true,
  requestFrame=requestAnimationTick,cancelFrame=cancelAnimationTick,setTimer=setTimeout,clearTimer=clearTimeout}){
  startedAt??=now();
  return new Promise((resolve,reject)=>{
    let done=false,frame=null,timer=null;
    const finish=(result,error)=>{
      if(done)return;done=true;
      if(frame!==null)cancelFrame(frame);if(timer!==null)clearTimer(timer);
      if(error)reject(error);else resolve(result);
    };
    const tick=(time,terminal=false)=>{
      if(done)return;frame=null;
      try{
        if(!isCurrent()){finish(false);return;}
        const elapsed=terminal?duration:Math.max(0,Math.min(duration,time-startedAt));
        draw(elapsed);
        if(elapsed>=duration){finish(true);return;}
        frame=requestFrame(tick);
      }catch(error){finish(false,error);}
    };
    timer=setTimer(()=>{
      if(frame!==null){cancelFrame(frame);frame=null;}
      tick(now(),true);
    },Math.max(0,duration-(now()-startedAt)));
    tick(now());
  });
}

import {field,splitRatio} from './physics.js';
export const initialState=()=>({goggles:false,wiring:false,lamp:false,warm:false,warmProgress:0,power:false,current:0,branch:'up',config:'transverse',coreOut:false,lampOut:false,probeIn:false,probeCentered:false,gaussZero:false,aligned:false,fpInserted:false,screws:[.45,-.32,.28],polAngle:90,polRecorded:false,qwp:false,qwpAngle:0,aperture:45,focus:40,distance:38,x:6,y:-4,viewOffset:0,viewChecked:false,selected:'safety',guideFocus:'gauss',d:.003,delta:.5,model:'physical',B:0,measureMode:'none',order:0,component:'a',heat:0,flags:{},demo:false});
export const parallel=s=>Math.hypot(s.screws[0]-(s.screws[1]+s.screws[2])/2,(s.screws[1]-s.screws[2])*.8660254)<.035;
export const centered=s=>Math.abs(s.x)<1.5&&Math.abs(s.y)<1.5;
export const sharp=s=>Math.abs(s.focus-65)<12&&Math.abs(s.aperture-60)<22&&Math.abs(s.distance-50)<12;
export const overlap=s=>splitRatio(s.B,s.d,4)>1;
export function transition(s,action,value){
 const fail=message=>({ok:false,message});
 switch(action){
 case 'goggles':if(s.lamp&&!value)return fail('汞灯运行时禁止摘下紫外防护镜。');s.goggles=value;break;
 case 'lamp':if(value&&(!s.goggles||!s.wiring))return fail('先戴紫外防护镜，并在断电状态检查连线。');if(value&&(s.lampOut||s.probeIn))return fail('请取出探测笔并装回汞灯。');s.lamp=value;if(!value){s.warm=false;s.warmProgress=0;}break;
 case 'wiring':if(s.power||s.lamp)return fail('高压危险：先关闭汞灯与励磁电源再检查接线。');s.wiring=value;break;
 case 'touch':if(s.lamp||s.power)return fail('高压危险：带电触碰汞灯接线柱已锁定，请先断电。');return {ok:true,message:'断电检查通过；实物操作仍需等待放电。'};
 case 'power':if(value&&(!s.wiring||s.coreOut))return fail('请断电检查连线并装回铁芯后再启励磁电源。');s.power=value;if(!value){if(s.current>0)s.branch='down';s.current=0;s.B=field(0,s.branch);}break;
 case 'current':if(!s.power)return fail('励磁电源未开启。');value=Number(value);if(!Number.isFinite(value)||value<0||value>7)return fail('模拟电流范围为 0～7 A。');if(value>s.current)s.branch='up';else if(value<s.current)s.branch='down';s.current=value;s.B=field(value,s.branch);if(value>6)return {ok:true,message:'线圈过热风险：励磁电流超过 6 A，请立即减小电流。'};break;
 case 'coreOut':if(s.power||s.lamp)return fail('机械/高压危险：先断开汞灯和励磁电源再取放铁芯。');s.coreOut=value;break;
 case 'config':if(s.power||s.lamp||!s.coreOut)return fail('机械危险：必须先断电、关闭汞灯、取出铁芯，再旋转线圈 90°。');s.config=value;s.flags.rotatedSafely=true;break;
 case 'lampOut':if(s.lamp)return fail('高压危险：先关闭汞灯，再取出灯管/插入探测笔。');s.lampOut=value;if(!value)s.probeIn=false;break;
 case 'probeIn':if(value&&(!s.lampOut||s.lamp))return fail('先关汞灯、取出汞灯，再插入轴向探测笔。');s.probeIn=value;break;
 case 'zero':if(s.probeIn&&s.B>.001)return fail('高斯计应在远离磁极的零场区域调零，请先移出探测笔。');s.gaussZero=true;break;
 case 'polAngle':s.polAngle=Number(value);s.polRecorded=false;break;
 case 'qwp':s.qwp=value;break;
 default:s[action]=value;
 }
 return {ok:true};
}
export function captureProblems(s){const p=[];if(!s.lamp||!s.warm)p.push('汞灯未预热完成');if(!s.aligned)p.push('光路尚未等高共轴');if(!s.fpInserted)p.push('F-P 标准具未接入');if(!parallel(s))p.push('先校平行度再调相机');if(!centered(s))p.push('圆环偏心，请微调 XY');if(!sharp(s))p.push('圆环尚未细锐，请调光阑、后焦及距离');if(s.B>.001&&!s.polRecorded)p.push('偏振片角度未记录');if(overlap(s))p.push('减小电流重拍，不要硬看');return p;}

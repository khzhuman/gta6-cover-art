// Normalized poster geometry serves both the painter and pointer hit testing.
window.FrameCatalog = (() => {
  const layouts = [
    {id:'hero', label:'Hero Split', note:'One lead. Two supporting scenes.', shapes:[
      [[0,0],[.59,0],[.54,1],[0,1]], [[.59,0],[1,0],[1,.49],[.565,.51]],
      [[.565,.51],[1,.49],[1,1],[.54,1]]]},
    {id:'trio', label:'Trio', note:'Three scenes. One story.', shapes:[
      [[0,0],[.335,0],[.335,1],[0,1]], [[.335,0],[.665,0],[.665,1],[.335,1]],
      [[.665,0],[1,0],[1,1],[.665,1]]]},
    {id:'quad', label:'Quad', note:'Four moments. One unforgettable cover.', shapes:[
      [[0,0],[.5,0],[.5,.5],[0,.5]], [[.5,0],[1,0],[1,.5],[.5,.5]],
      [[0,.5],[.5,.5],[.5,1],[0,1]], [[.5,.5],[1,.5],[1,1],[.5,1]]]},
    {id:'duo', label:'Wide Duo', note:'Two cinematic bands. Made for wide.', shapes:[
      [[0,0],[1,0],[1,.54],[0,.46]], [[0,.46],[1,.54],[1,1],[0,1]]]}];
  const moods = [
    {id:'sunset',label:'Vice Sunset',colors:['#ffb166','#ed839d','#9249aa'],mode:'soft-light',opacity:.48,contrast:1.13,saturation:1.16,gray:0},
    {id:'neon',label:'Neon Nights',colors:['#48dfd1','#8474c2','#e942aa'],mode:'color',opacity:.67,contrast:1.2,saturation:.9,gray:.52},
    {id:'golden',label:'Golden Hour',colors:['#f8d99b','#efb97d','#cb8c78'],mode:'soft-light',opacity:.34,contrast:1.06,saturation:1.06,gray:0},
    {id:'clean',label:'Clean',colors:['#eee9de','#a3b6bb'],mode:'source-over',opacity:0,contrast:1,saturation:1,gray:0}];
  const formats = [
    {id:'square',label:'Square',ratio:'1:1',w:1080,h:1080},
    {id:'portrait',label:'Portrait',ratio:'4:5',w:1080,h:1350},
    {id:'wide',label:'Wide',ratio:'16:9',w:1920,h:1080}];
  const scenes = [
    ['portrait','The heroine','sample-portrait.jpg'], ['car','The getaway','sample-car.jpg'],
    ['beach','The coastline','sample-beach.jpg'], ['man','The leading man','sample-man.jpg'],
    ['boulevard','Ocean Drive','boulevard.jpg'], ['pier','The pier','pier.jpg']
  ].map(([id,label,file]) => ({id,label,src:`samples/${file}`}));
  const limit = (n,lo,hi) => Math.max(lo,Math.min(hi,n));
  function geometry(id,w,h) {
    const inset = Math.min(w,h)*.014;
    return layouts.find(item=>item.id===id).shapes.map((shape,index)=>{
      const vertices=shape.map(([x,y])=>[inset+x*(w-2*inset),inset+y*(h-2*inset)]);
      const left=Math.min(...vertices.map(p=>p[0])), top=Math.min(...vertices.map(p=>p[1]));
      return {index,vertices,x:left,y:top,w:Math.max(...vertices.map(p=>p[0]))-left,h:Math.max(...vertices.map(p=>p[1]))-top};
    });
  }
  function contains(vertices,x,y) {
    let hit=false;
    for(let a=0,b=vertices.length-1;a<vertices.length;b=a++) {
      const [ax,ay]=vertices[a], [bx,by]=vertices[b];
      if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) hit=!hit;
    }
    return hit;
  }
  return {layouts,moods,formats,scenes,geometry,contains,limit};
})();

/**
 * Created by jusfoun-fe.github.io on 2017/11/19.
 * 3D地图
 */
import Detector from './Detector.js'
import * as THREE from './three.js'
import TWEEN from './tween.min.js'
import './OrbitControls.js'
import './Event.js'
import Stats from './stats.js'

//地图立体参数设置
var extrudeOption = {
    amount : 2,
    bevelThickness : 1,
    bevelSize : .2,
    bevelEnabled : false,
    bevelSegments : 5,
    curveSegments :1,
    steps : 1,
};


export default class Map3D{
    constructor(o){
        if(!Detector.webgl) {
            console.log('不支持webgl,停止渲染.');
            return;
        }
        let opt={
            /*外部参数*/
            name:'',            //调试使用，window['name']为该实例对象，注意设置debugger:true启用
            el:document.body,
            hasStats:true,      //是否显示性能面板
            hasControls:true,   //用户是否能控制视角
            autoRotate:false,   //是否自动旋转视角
            hasLoadEffect:false,//是否有加载效果
            data:null,          //地图geojson数据
            userData:[],        //地图用户数据[{name:'北京',value:,color:0xff3333}...]
            debugger:false,     //调试模式
            color:0x3366ff,     //地图颜色
            hoverColor:0xff9933,//鼠标移入颜色
            lineColor:0xffffff, //线颜色
            ambientColor:0x333333,//环境光颜色
            directionalColor:0xffffff,//平行光颜色
            opacity:1,          //地图透明度
            hasPhong:true,      //是否反光材质
            shininess:100,      //反光材质光滑度
            hoverAnimaTime:200, //鼠标移入动画过渡时间
            onresize:null,
            onmouseover:null,
            onmouseout:null,
            onmousedown:null,
            cameraPosition:{x:0,y:0,z:40},//相机位置
            extrude:extrudeOption,
            visualMap:null,     //直观图图例
            /*内部对象*/
            mapObject:null,//地图对象-内部调用
            scene:null,//场景对象-内部调用
            camera:null,//相机对象-内部调用
            renderer:null,//渲染器对象-内部调用
            stats:null,//性能对象-内部调用
            controls:null,//控制器对象-内部调用
            areaCount:0,
            _w:0,
            _h:0,
            __event:null,//事件对象
        }
        Object.assign(this,opt,o)
        if(!this.data)
        {
            console.warn('Map3D no data.')
            return;
        }
        this._w=this.el.offsetWidth;
        this._h=this.el.offsetHeight;
        this.init()
        this.initEvent()
    }
    init(){
        this.el.innerHTML='';
        this.scene = new THREE.Scene({antialias:true});
        this.camera = new THREE.PerspectiveCamera(70, this._w/this._h, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({alpha:true});
        this.renderer.setPixelRatio( window.devicePixelRatio );
        this.camera.position.set(0,0,40);

        this.camera.lookAt(this.scene.position);
        this.renderer.setSize(this._w,this._h);

        this.hasControls && this.initControls()

        this.scene.add(new THREE.AmbientLight(colorToHex(this.ambientColor)));
        this.dirLight = new THREE.DirectionalLight(colorToHex(this.directionalColor));
        this.dirLight.position.set(0,50,50);
        this.scene.add(this.dirLight);

        this.spotLight = new THREE.SpotLight(colorToHex(this.color));
        this.spotLight.position.set(0,150,0);
        this.spotLight.intensity = 0.7;
        this.spotLight.target = this.scene;
        this.scene.add(this.spotLight);

        this.initDebug();

        this.mapObject = new THREE.Group();
        this.data.features.forEach((item)=>{
            //地图属性 & 用户属性合并
            let itemUserData = this.userData.find(val=> val.name===item.properties.name );
            Object.assign(item.properties,itemUserData);
            this.createArea(item,this.mapObject);
        })

        //根据数据中心位置偏移
        if(this.data.cp){
            this.mapObject.position.set(-this.data.cp[0],-this.data.cp[1],0);
        }
        this.scene.add(this.mapObject);

        this.scene.add(this.camera);
        this.el.appendChild(this.renderer.domElement);
        this.renderScene();
    }
    addCameraPosition(ps,time,delay){
      let v=new THREE.Vector3(ps.x,ps.y,ps.z);
      if(typeof time ==='number'){
        let to = this.camera.position.clone().add(v);
        new TWEEN.Tween(this.camera.position).to(to,time).delay(delay||0).start();
      }
      else
        this.camera.position.add(v);
    }
    setCameraPosition(ps,time,delay){
        let v=new THREE.Vector3(ps.x,ps.y,ps.z);
        if(typeof time ==='number'){
            new TWEEN.Tween(this.camera.position).to(v,time).delay(delay||0).start();
        }
        else
            this.camera.position.set(v);
    }
    dispose(){
        this.el.innerHTML='';
        this.__event.dispose();
    }
    disable(disable){
        disable=typeof disable==='undefined'?true:disable;
        if(disable){
            this.el.style.pointerEvents='none';
            this.__event.enable=!disable;
        }
        else
        {
            this.el.style.pointerEvents='';
            this.__event.enable=!disable;
        }
    }
    initEvent(){
        this.__event=new THREE.Event(this);
    }
    initControls(){
        this.controls = new THREE.OrbitControls(this.camera,this.renderer.domElement);
        this.controls.userPan=false;
        this.controls.autoRotate=this.autoRotate;
        this.controls.userPanSpeed=1;
        return this.controls;
    }
    initStats(){
        this.stats = new Stats();
        this.stats.setMode(0);//0:fps |1:ms
        this.stats.domElement.style.position='absolute';
        this.stats.domElement.style.top='70px';
        this.stats.domElement.style.right='0px';
        this.el.appendChild(this.stats.domElement);
        return this.stats;
    }
    initDebug(){
      if(!this.debugger) return
      if(this.name){
        window[this.name]=this;
      }
      this.initStats();
      let helper = new THREE.DirectionalLightHelper( this.dirLight, 5 );
      this.scene.add( helper );
      let spotLightHelper = new THREE.SpotLightHelper( this.spotLight );
      this.scene.add( spotLightHelper );
      let size = 300;
      let divisions = 40;
      let gridHelper = new THREE.GridHelper( size, divisions );
      this.scene.add( gridHelper );
      let axisHelper = new THREE.AxisHelper( 50 );
      this.scene.add( axisHelper );

      this.infoPlane = document.createElement('div');
      this.infoPlane.contentEditable=true;
      this.infoPlane.style.position='absolute';
      this.infoPlane.style.bottom='70px';
      this.infoPlane.style.right='10px';
      this.infoPlane.style.padding ='5px 10px';
      this.infoPlane.style.background ='rbga(0,0,0,.5)';
      this.infoPlane.style.border ='1px solid #aaa';
      this.infoPlane.style.borderRadius='5px';
      this.infoPlane.style.color='#eee';
      this.el.appendChild(this.infoPlane);
    }
    printCameraPosition(){
        let v3=this.camera.position;
        this.infoPlane.textContent='相机位置 {x:'+v3.x.toFixed(4)+",y:"+v3.y.toFixed(4)+",z:"+v3.z.toFixed(4)+'}';
    }
    setArea(area,userData){
        if(typeof area === 'string')
            area=this.findArea(area);
        if(userData.name)
        {
            delete userData.name;
            console.warn('setAreaData():No name parameters are required')
        }
        //重新构造区域
        let item=this.data.features.find(item=>item.properties.name===area.name);
        if(item){
            this.reomveArea(area);
            Object.assign(item.properties,userData);
            this.createArea(item,this.mapObject);
        }
    }
    reomveArea(area){
        if(typeof area === 'string')
            area=this.findArea(area);
        this.mapObject.remove(area);
    }
    findArea(areaName){
        return this.mapObject.getObjectByName(areaName);
    }
    getObjectsByName(name){
        let objects=[];
        this.scene.traverse((obj)=>{
          if(obj.name===name){
            objects.push(obj);
          }
        })
      return objects;
    }
    renderScene(){
        this.renderer.clear();
        requestAnimationFrame(this.renderScene.bind(this));

        TWEEN.update();

        if(this.hasControls)
            this.controls.update();

        if(this.debugger){
          this.stats.update();
          this.printCameraPosition();
        }

        this.renderer.render(this.scene, this.camera);

    }
    _onResize(){

    }
    _onMouseMove(event,intersects){
        if ( intersects.length > 0 ) {
          if(this.selectedArea){
            //移出区域还原
            new TWEEN.Tween( this.selectedArea.position ).to({z: 0,}, this.hoverAnimaTime).start()
            let color = typeof this.selectedArea.userData.color==='undefined'?this.color:this.selectedArea.userData.color;
            new TWEEN.Tween(this.selectedArea.children[0].material.color).to(new THREE.Color(colorToHex(color)), this.hoverAnimaTime).start();
            if(this.onmouseout)
              this.onmouseout(event,this.selectedArea)
          }
            let has=false;
            for(let i=0;i<intersects.length;i++){
                if(intersects[i].object && intersects[i].object.type==='Mesh' && intersects[i].object.parent.type && intersects[i].object.parent.type==='Area')
                {
                    this.selectedArea=intersects[ i ].object.parent;
                    has=true;
                    break;
                }
            }
            if(has)
            {
              //区域移入高度
              //this.selectedArea.position.z=1;
              new TWEEN.Tween( this.selectedArea.position ).to({z: this.extrude.amount/2,}, this.hoverAnimaTime).start();
              //区域移入颜色
              let hoverColor=typeof this.selectedArea.userData.hoverColor==='undefined'?this.hoverColor:this.selectedArea.userData.hoverColor;
              new TWEEN.Tween(this.selectedArea.children[0].material.color).to(new THREE.Color(colorToHex(hoverColor)), this.hoverAnimaTime).start();
              if(this.onmouseover)
                this.onmouseover(event,this.selectedArea);
            }
            else{
              if(this.selectedArea){
                //移出区域还原
                new TWEEN.Tween( this.selectedArea.position ).to({z: 0,}, this.hoverAnimaTime).start()
                let color = typeof this.selectedArea.userData.color==='undefined'?this.color:this.selectedArea.userData.color;
                new TWEEN.Tween(this.selectedArea.children[0].material.color).to(new THREE.Color(colorToHex(color)), this.hoverAnimaTime).start();
                if(this.onmouseout)
                  this.onmouseout(event,this.selectedArea)
              }
            }
        } else {
            if(this.selectedArea){
              //移出区域还原
              new TWEEN.Tween( this.selectedArea.position ).to({z: 0,}, this.hoverAnimaTime).start()
              let color = typeof this.selectedArea.userData.color==='undefined'?this.color:this.selectedArea.userData.color;
              new TWEEN.Tween(this.selectedArea.children[0].material.color).to(new THREE.Color(colorToHex(color)), this.hoverAnimaTime).start();
              if(this.onmouseout)
                this.onmouseout(event,this.selectedArea)
            }
        }
    }
    _onMouseDown(event,intersects){

        if ( intersects.length > 0 ) {
            for(let i=0;i<intersects.length;i++){
                if(intersects[i].object && intersects[i].object.type=='Mesh' && intersects[i].object.parent.type && intersects[i].object.parent.type=='Area')
                {
                    this.selectedArea=intersects[ i ].object.parent;
                    break;
                }
            }
            if(this.selectedArea)
            {
                this.debugger && console.log(this.selectedArea)
                if(this.onmousedown)
                    this.onmousedown(event,this.selectedArea)
            }
        }
    }
    //创建地图区域块
    //结构 parentObj:[{g:[mesh,line]},{g:[mesh,line]}...]
    createArea(item,parentObj){
        //item.properties 一般有{id,name,cp,childNum,color,value}

        if(item.geometry.type=='Polygon'){
            this.addMesh(item.properties,
                item.geometry.coordinates[0],
                parentObj);
        }
        else if (item.geometry.type=='MultiPolygon') {
            for(var i=0;i<item.geometry.coordinates.length;i++){
                this.addMesh(item.properties,
                    item.geometry.coordinates[i][0],
                    parentObj);
            }
        }
    }
    addMesh(pros,coord,parentObj){
        let g=new Area();
        g.name=pros.name;
        Object.assign(g.userData,pros);
        let mesh=this.GetMesh(coord,pros);
        let line=this.GetLine(coord,pros);
        g.add(mesh);
        g.add(line);
        //
        // if(this.hasLoadEffect){
        //     g.position.z=300;
        //     new TWEEN.Tween( g.position ).to( {
        //         z: 0,}, 300+(this.areaCount++*80) )
        //         .easing( TWEEN.Easing.Elastic.In)
        //         .start().onComplete(function(){
        //
        //     });
        // }
        parentObj.add(g);
    }
    //创建立体块
    GetMesh(coord,pros){
      if(!coord)return;
      try{
        let pts=Map3D.getGeoPoints(coord);
        let geo=this.getExtrudeGeometry(pts);
        return this.getGeoMesh(geo,pros);
      }catch(e)
      {
        console.log(e);
      }
    }
    //创建块的边缘线
    GetLine(coord,pros){
      if(!coord)return;
        let pts=Map3D.getGeoPoints(coord);
        let lines = new THREE.Geometry();

        for(let i=0,l=pts.length;i<l;i++){
            lines.vertices.push(new THREE.Vector3(pts[i].x,pts[i].y,this.extrude.amount + this.extrude.amount/50));
        }

        let material = new THREE.LineBasicMaterial({
            opacity: 1.0,
            linewidth: 2,
            color:this.lineColor
        });
        return new THREE.Line(lines, material);
    }
    //得到顶点数据
    static getGeoPoints(coordinates){
      try{
        let pts=[];
        for(let i=0,l=coordinates.length;i<l;i++){
            pts.push(new THREE.Vector2(coordinates[i][0],coordinates[i][1]));
        }
        return pts;
      }catch(e)
      {
        console.log(coordinates);
      }
    }
    //拉伸块高度
    getExtrudeGeometry(pts){
      let shape = new THREE.Shape(pts);
      let geo = new THREE.ExtrudeGeometry(shape, this.extrude);
      return geo;
    }
    //创建平面块
    getGeoMesh(geo,pros){
      let mateOption={};
      mateOption.color = colorToHex(pros.color) || this.color || Math.random() * 0xffffff;
      mateOption.shininess= pros.shininess || 100;
      mateOption.transparent= true;
      mateOption.opacity = (typeof pros.opacity === 'undefined') ? this.opacity : pros.opacity;

      let geoMesh=null;
      if(this.hasPhong)
          geoMesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial(mateOption));
      else
          geoMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial(mateOption));
      //var geoMesh = THREE.SceneUtils.createMultiMaterialObject(geo,[new THREE.MeshPhongMaterial(mateOption),new THREE.MeshBasicMaterial({wireframe:true,color:0xffffff,transparent:true,opacity:0.35})])
      return geoMesh;
    }

    /* Map3D静态方法 */
    //过渡动画
    static transition(from,to,time,delay,callback){
        if(typeof time !=='number'){
          time=1000;
        }
        if(!callback)callback=()=>{};
      new TWEEN.Tween(from).to(to,time).delay(delay||0).start().onComplete(callback);
   }

}

//颜色格式化 '#999999','rgb','hsl',0x999999
function colorToHex(color){
    if(typeof color==="string" )
    {
        if(color.indexOf('#')!==-1)
            color = parseInt(color.replace('#',''),16);
        else
            color = new THREE.Color(color).getHex();
    }
    return color;
}


//地图区域
class Area extends THREE.Group{
  //构造函数
  constructor(props){
    //调用实现父类的构造函数
    super(props);
    this.type="Area";
  }
  get mesh(){
    return this.children[0];
  }
  get line(){
    return this.children[1];
  }
  setColor(color,time,delay,callback){
    this.userData.color=colorToHex(color);
    if(time && typeof time==='number'){
      color=new THREE.Color(colorToHex(color));
      Map3D.transition(this.mesh.material.color,color,time,delay,callback);
    }
    else {
      this.mesh.material.color.set(colorToHex(color));
    }
  }
  setPosition(v3,time,delay,callback){
    if(time && typeof time==='number')
      Map3D.transition(this.position,v3,time,delay,callback);
    else
      this.position.set(v3.x,v3.y,v3.z);
  }
  setRotation(v3,time,delay,callback){
    v3.x=v3.x * (Math.PI / 180)
    v3.y=v3.y * (Math.PI / 180)
    v3.z=v3.z * (Math.PI / 180)
    Map3D.transition(this.rotation,v3,time,delay,callback);
  }
  setScale(v3,time,delay,callback){
    if(time && typeof time==='number')
      Map3D.transition(this.scale,v3,time,delay,callback);
    else
      this.scale.set(v3.x,v3.y,v3.z);
  }


}

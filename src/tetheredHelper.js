//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//steve's positional helper library
//

function tetheredHelper(renderer, interval, panels, offset) {
  
  // constructor
  this.panels     = panels;
  this.renderer   = renderer;
  this.interval   = interval;
  this.offset     = (offset != undefined) ? offset : 0.5;
    
  this.lerping    = undefined;
  
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // based on the head location (arg) let's determine if we need to move the
  // tracked items ('panels') - it we do need to move them, kick off a small
  // animation to move the items to the final resting location
  this.headTether = function(arg) { 
  
    // arg containts position, gaze and up
    // lets get the position (this is the xyz position of the head RELATIVE to the tracking target)
  
    var position = new Vector4().Set3a(arg.position);	//Position as a vector
    var gaze     = new Vector4().Set3 (-arg.gaze[0],-arg.gaze[1],-arg.gaze[2]);  

    // lets get the gaze (vector) and the up (vector)
    var up    = new Vector4().Set3a(arg.up); 
    var yup   = new Vector4().Set3(0,1,0);
    if (Math.abs(yup.DotP(gaze)) < 0.707) up = yup; // keep item vertical when head is generally looking horizontal-ish
    var xd    = up.CrossP(gaze).Normalize();
    var nup   = gaze.CrossP(xd); // recalc up
 
    // from gaze, up  we calculate the bitangent (nup) and from this we can calculate the view matrix
    var em = new Matrix4().Set3V(xd,nup,gaze);
    // lets turn the matrix into euler angles
    var es = em.ToPosEuler(true).rot;  
    
    var dolerp = 0;
    
    // put the destination point a certain x,z offset  away from the head
    for(var p=0;p<this.panels.length;p++) {
      var panel  = this.panels[p];
      var dx     = panel.delta!=undefined?panel.delta[0]:0;
      var dz     = panel.delta!=undefined?panel.delta[1]:1;
      var hdelta = gaze.Add(xd.Scale(dx));
      
      // set the final destination location - note that this can change whilst the
      // panel(s) are moving i.e. they will rty to keep up with the head
      panel.targetPos = position.Sub(hdelta.Scale(dz));
      
      // the panels may need this information when they are animating
      panel.es   = es;
      panel.em   = em;
    
      // first time, just position the item at the destination point
      if (panel.ipos === undefined) {
        var lerp = panel.targetPos;
        this.renderer.setTranslation(panel.name,     lerp.X(),     lerp.Y(),     lerp.Z());
        this.renderer.setRotation   (panel.name, panel.es.X(), panel.es.Y(), panel.es.Z());
        panel.ipos = lerp;
      }
  
      // otherwise, only move it IF it is > 0.5m away from where it was last placed
      // note also : we only try this IF it is not already moving to the new position.
      else if (this.lerping === undefined && 
               panel.ipos.Sub(panel.targetPos).Length() > this.offset) {
    
        // the image rotates to always point towards the camera 
        panel.tweend = 0;
        
        // make sure we call only once
        panel.triggered = false;
        if (!panel.triggered && panel.onMoveStart != undefined) { 
          // let the caller know that the panel is about to move; they
          // might choose to do something
          panel.onMoveStart(this,panel)
        } 
        
        // hide buttons whilst moving
        if (!panel.triggered && panel.buttons != undefined) {
          var me = this;
          panel.buttons.forEach(function(button) {
            me.renderer.setProperties (button.name+'_button',{hidden:true});
            me.renderer.setProperties (button.name+'_backer',{hidden:true});
          });
        }
        panel.triggered = true;
            
        dolerp += 1;
      }
    }
    
    // only start the animation if ALL the panels say so
    if (dolerp === this.panels.length) {
      this.lerping = this.interval(this._lerp(this), 100); 
    }
  }
  
  ////////////////////////////////////////////////////////////////////
  // change the panels we are managing
  this.setPanels = function(panels,callback) {
      
    //kill off and hide any existing panels that we have under management
    if (this.lerping != undefined) {
      this,interval.cancel(this.lerping);
      this.lerping = undefined;
      
      // do we 'hide' the old ones
      if (callback != undefined) callback(this.panels); // let the caller do it
      else {
        for (var p=0;p<this.panels.length;p++) {
          var panel = this.panels[0];
          if (panel.buttons != undefined) for (var b=0;b<panel.buttons.length;b++) {
            var button = panel.buttons[b];
            this.renderer.setProperties (button.name+'_button',{hidden:true});
            this.renderer.setProperties (button.name+'_backer',{hidden:true});
          }
          this.renderer.setProperties (panel.name,{hidden:true});
        }
      }
    }
    
    //and install new ones
    this.panels = panels;
  }

  //////////////////////////////////////////////////////////////////
  // (private) handles the animated tehtered behaviour, moving the
  // panels to the new target
  this._lerp = function(obj) {
    
    var tobj = obj;
    return function() {
      
      var endlerp = 0;
      
      // for each panel...
      for(var p=0;p<tobj.panels.length;p++) {
        var tpan  = tobj.panels[p];
        
        // we are blending/lerping our way along a vector from 0..1 where the end is panel.targetPos
        // the current location is that lerped value
        var lerp        = tpan.targetPos != undefined ? tpan.ipos.Tween(tpan.targetPos, tpan.tweend) 
                                                      : tpan.ipos;
        tpan.tweend    += 0.05;
        
        // the orientation is the current head orientation
        tpan.targetGaze = tpan.es;
        tpan.targetem   = tpan.em;
        
        // lets move the panel
        tobj.renderer.setTranslation(tpan.name,            lerp.X(),            lerp.Y(),            lerp.Z());
        tobj.renderer.setRotation   (tpan.name, tpan.targetGaze.X(), tpan.targetGaze.Y(), tpan.targetGaze.Z());
        
        // when we rech the end, stop lerping this panel
        if(tpan.tweend>=1.0) {
            
          endlerp       += 1;
          tpan.ipos = lerp;
          
          if (tpan.triggered === true && tpan.onMoveEnded != undefined) { 
            // let the caller know that the panel is finished moving; they
            // might choose to do something
            tpan.onMoveEnded(tobj,tpan)
          } 

          // unhide and move buttons when we stop
          if (tpan.triggered && tpan.buttons != undefined) tpan.buttons.forEach(function(button) {
                                                                                
            // new location for ths button is the button offset transformed by the matrix which orients the panel and then
            // positioned along the lerped vector
            var ab = new Vector4().Set3a(button.loc).Transform(tpan.targetem).Add(lerp);
            
            tobj.renderer.setTranslation(button.name,             ab.X(),              ab.Y(),              ab.Z());
            tobj.renderer.setRotation   (button.name,tpan.targetGaze.X(), tpan.targetGaze.Y(), tpan.targetGaze.Z());
            tobj.renderer.setProperties (button.name+'_button',{hidden:false});
            tobj.renderer.setProperties (button.name+'_backer',{hidden:!button.backpanel});
          });
          tpan.triggered = false;    
        }
      }
      
      // once all the panels have stopped, we kill off the animation
      if (endlerp === tobj.panels.length) {
        tobj.interval.cancel(tobj.lerping);
        tobj.lerping = undefined;
      }
    }
  }

}

if (exports != undefined) exports.tetheredHelper = tetheredHelper;



//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//steve's simple matrix/vector library (reduced version)
//
function Matrix4() {
  this.m = [ [1, 0, 0, 0],
             [0, 1, 0, 0],
             [0, 0, 1, 0],
             [0, 0, 0, 1]];
  this.Set3V = function(v1,v2,v3) {
    this.m[0][0] = v1.v[0];
    this.m[0][1] = v1.v[1];
    this.m[0][2] = v1.v[2];
    this.m[1][0] = v2.v[0];
    this.m[1][1] = v2.v[1];
    this.m[1][2] = v2.v[2];
    this.m[2][0] = v3.v[0];
    this.m[2][1] = v3.v[1];
    this.m[2][2] = v3.v[2];
    return this;
  }
  this.Set4V = function(v1,v2,v3,v4) {
    this.m[0][0] = v1.v[0];
    this.m[0][1] = v1.v[1];
    this.m[0][2] = v1.v[2];
    this.m[1][0] = v2.v[0];
    this.m[1][1] = v2.v[1];
    this.m[1][2] = v2.v[2];
    this.m[2][0] = v3.v[0];
    this.m[2][1] = v3.v[1];
    this.m[2][2] = v3.v[2];
    this.m[3][0] = v4.v[0];
    this.m[3][1] = v4.v[1];
    this.m[3][2] = v4.v[2];
    return this;
  }
  this.Translate = function (x, y, z) {
    var t = [ [1, 0, 0, 0],
              [0, 1, 0, 0],
              [0, 0, 1, 0],
              [x, y, z, 1]];
    return this.Multiply(t);
  }
  this.Scale = function (x, y, z) {
    var s = [ [x, 0, 0, 0],
              [0, y, 0, 0],
              [0, 0, z, 0],
              [0, 0, 0, 1]];
    return this.Multiply(s);
  }
  this.Rotate = function (axis,angle,deg) {
    function deg2rad(d) { return (deg!=undefined) ? d * Math.PI / 180 : d; }
    var s  = Math.sin(deg2rad(angle));
    var c0 = Math.cos(deg2rad(angle));
    var c1 = 1 - c0;
    // assume normalised input vector
    var u = axis[0];
    var v = axis[1];
    var w = axis[2];
    var r = [
      [(u * u * c1) + c0,      (u * v * c1) + (w * s), (u * w * c1) - (v * s), 0],
      [(u * v * c1) - (w * s), (v * v * c1) + c0,      (v * w * c1) + (u * s), 0],
      [(u * w * c1) + (v * s), (w * v * c1) - (u * s), (w * w * c1) + c0,      0],
      [0,                      0,                      0,                      1]
    ];
    return this.Multiply(r);
  }
  this.RotateFromEuler = function(x,y,z,deg) {
    var mt = new Matrix4()
             .Rotate([1,0,0],x,deg)
             .Rotate([0,1,0],y,deg)
             .Rotate([0,0,1],z,deg);
    return this.Multiply(mt.m); 
  }
  this.Multiply = function (b) {
    var dst = [ 
      [   ((this.m[0][0] * b[0][0]) + (this.m[0][1] * b[1][0]) + (this.m[0][2] * b[2][0]) + (this.m[0][3] * b[3][0])),
          ((this.m[0][0] * b[0][1]) + (this.m[0][1] * b[1][1]) + (this.m[0][2] * b[2][1]) + (this.m[0][3] * b[3][1])),
          ((this.m[0][0] * b[0][2]) + (this.m[0][1] * b[1][2]) + (this.m[0][2] * b[2][2]) + (this.m[0][3] * b[3][2])),
          ((this.m[0][0] * b[0][3]) + (this.m[0][1] * b[1][3]) + (this.m[0][2] * b[2][3]) + (this.m[0][3] * b[3][3])) ],
      [   ((this.m[1][0] * b[0][0]) + (this.m[1][1] * b[1][0]) + (this.m[1][2] * b[2][0]) + (this.m[1][3] * b[3][0])),
          ((this.m[1][0] * b[0][1]) + (this.m[1][1] * b[1][1]) + (this.m[1][2] * b[2][1]) + (this.m[1][3] * b[3][1])),
          ((this.m[1][0] * b[0][2]) + (this.m[1][1] * b[1][2]) + (this.m[1][2] * b[2][2]) + (this.m[1][3] * b[3][2])),
          ((this.m[1][0] * b[0][3]) + (this.m[1][1] * b[1][3]) + (this.m[1][2] * b[2][3]) + (this.m[1][3] * b[3][3])) ],
      [   ((this.m[2][0] * b[0][0]) + (this.m[2][1] * b[1][0]) + (this.m[2][2] * b[2][0]) + (this.m[2][3] * b[3][0])),
          ((this.m[2][0] * b[0][1]) + (this.m[2][1] * b[1][1]) + (this.m[2][2] * b[2][1]) + (this.m[2][3] * b[3][1])),
          ((this.m[2][0] * b[0][2]) + (this.m[2][1] * b[1][2]) + (this.m[2][2] * b[2][2]) + (this.m[2][3] * b[3][2])),
          ((this.m[2][0] * b[0][3]) + (this.m[2][1] * b[1][3]) + (this.m[2][2] * b[2][3]) + (this.m[2][3] * b[3][3])) ],
      [   ((this.m[3][0] * b[0][0]) + (this.m[3][1] * b[1][0]) + (this.m[3][2] * b[2][0]) + (this.m[3][3] * b[3][0])),
          ((this.m[3][0] * b[0][1]) + (this.m[3][1] * b[1][1]) + (this.m[3][2] * b[2][1]) + (this.m[3][3] * b[3][1])),
          ((this.m[3][0] * b[0][2]) + (this.m[3][1] * b[1][2]) + (this.m[3][2] * b[2][2]) + (this.m[3][3] * b[3][2])),
          ((this.m[3][0] * b[0][3]) + (this.m[3][1] * b[1][3]) + (this.m[3][2] * b[2][3]) + (this.m[3][3] * b[3][3])) ]];
    this.m = dst;
    return this;
  }
  this.ToString = function () {
    var s = '';
    for (var i = 0; i < 4; i++) {
      s = s.concat(this.m[i].toString());
      s = s.concat(',');
    }
    // now replace the commas with spaces
    s = s.replace(/,/g, ' ');
    return s;
  }
  this.ToEuler = function(toDeg) {
    
    // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
    var m11 = this.m[0][0], m12 = this.m[1][0], m13 = this.m[2][0];
    var m21 = this.m[0][1], m22 = this.m[1][1], m23 = this.m[2][1];
    var m31 = this.m[0][2], m32 = this.m[1][2], m33 = this.m[2][2];
    var sy  = Math.sqrt(m32 * m32 + m33 * m33);
     
    var singular = (sy < 0.000001) ? true : false;
    var _x, _y, _z;
        
    if (singular === false) {
      _x = Math.atan2(  m32, m33);
      _y = Math.atan2(- m31, sy);
      _z = Math.atan2(  m21, m11);
    } else {
      _x = Math.atan2(- m32, m22);
      _y = Math.atan2(- m31, sy);
      _z = 0;
    }
        
    // convert to degrees?
    var deg = (toDeg != undefined) ? 180.0/Math.PI : 1; 
    var attitude = deg * _x; // make this left handed
    var heading  = deg * _y;
    var bank     = deg * _z;
        
    return { 
      attitude:attitude, 
      heading :heading, 
      bank    :bank 
    };
  }

  this.ToPosEuler = function(toDeg) {
    var clamp = function(x) {
      if (Math.abs(x) < 1e-6)
        return 0;
      else 
        return x;
    }

    var rot = this.ToEuler(toDeg);
        
    var simple = {};
    simple.pos = new Vector4().Set3(clamp(this.m[3][0]), clamp(this.m[3][1]), clamp(this.m[3][2]));
    simple.rot = new Vector4().Set3(rot.attitude, rot.heading, rot.bank);
    return simple;
  }
}

//
// vector4
//
function Vector4() {
  this.v = [0, 0, 0, 1];
  this.Set = function (x) {
    this.v[0] = x.v[0];
    this.v[1] = x.v[1];
    this.v[2] = x.v[2];
    return this;
  }
  this.Set3 = function (x, y, z) {
    this.v[0] = x;
    this.v[1] = y;
    this.v[2] = z;
    return this;
  }
  this.Set3a = function (a) {
    this.v[0] = a[0];
    this.v[1] = a[1];
    this.v[2] = a[2];
    return this;
  }
  this.Set4 = function (x, y, z, w) {
    this.v[0] = x;
    this.v[1] = y;
    this.v[2] = z;
    this.v[3] = w;
    return this;
  }
  this.Set4a = function (a) {
    this.v[0] = a[0];
    this.v[1] = a[1];
    this.v[2] = a[2];
    this.v[3] = a[3];
    return this;
  }
  this.FromEuler = function (e) {
    this.v[0] = e.attitude;
    this.v[1] = e.heading;
    this.v[2] = e.bank;
    this.v[3] = 1.0;
    return this;
  }
  this.X = function() { return this.v[0] }
  this.Y = function() { return this.v[1] }
  this.Z = function() { return this.v[2] }
  this.W = function() { return this.v[3] }
  this.FromString = function (str) {
    var pcs = str.split(',');
    this.v[0] = parseFloat(pcs[0]);
    this.v[1] = parseFloat(pcs[1]);
    this.v[2] = parseFloat(pcs[2]);
    this.v[3] = pcs.length > 3 ? parseFloat(pcs[2]) : 1.0;
    return this;
  }
  this.Length = function () {
    var hyp = (this.v[0] * this.v[0]) + (this.v[1] * this.v[1]) + (this.v[2] * this.v[2]);
    var rad = (hyp > 0) ? Math.sqrt(hyp) : 0;
    return rad;
  }
  this.Distance = function(v2,mask) {
    if (mask === undefined) mask = [1,1,1];
    var x = mask[0]*(this.v[0] - v2.v[0]);
    var y = mask[1]*(this.v[1] - v2.v[1]);
    var z = mask[2]*(this.v[2] - v2.v[2]);
    var hyp  = (x * x) + (y * y) + (z* z);
    var dist = (hyp > 0) ? Math.sqrt(hyp) : 0;
    return dist;    
  }
  this.LengthAxis2 = function (aidx) {
    var hyp = (this.v[aids] * this.v[aids]);
    return hyp;
  }
  this.Normalize = function () {
    var rad   = this.Length();
    this.v[0] = this.v[0] / rad;
    this.v[1] = this.v[1] / rad;
    this.v[2] = this.v[2] / rad;
    return this;
  }
  this.DotP = function (v2) {
    // cos(theta)
    var cost = (this.v[0] * v2.v[0]) + (this.v[1] * v2.v[1]) + (this.v[2] * v2.v[2]);
    return cost;
  }
  this.CrossP = function (v2) {
    var x = (this.v[1] * v2.v[2]) - (v2.v[1] * this.v[2]);
    var y = (this.v[2] * v2.v[0]) - (v2.v[2] * this.v[0]);
    var z = (this.v[0] * v2.v[1]) - (v2.v[0] * this.v[1]);
    var cross = new Vector4().Set3(x, y, z);
    return cross;
  }
  this.Add = function (v2) {
    var add = new Vector4().Set3( (this.v[0] + v2.v[0]),
                                  (this.v[1] + v2.v[1]),
                                  (this.v[2] + v2.v[2]) );
    return add;
  }
  this.Sub = function (v2) {
    var add = new Vector4().Set3( (this.v[0] - v2.v[0]),
                                  (this.v[1] - v2.v[1]),
                                  (this.v[2] - v2.v[2]) );
    return add;
  }
  this.Scale = function (s) {
    var scale = new Vector4().Set3(this.v[0]*s, this.v[1]*s, this.v[2]*s);
    return scale;
  }
  this.Tween = function(v2,d) {
    // result = a + (b-a).d, assuming d normalised 0..1
    var i = v2.Sub(this).Scale(d).Add(this);
    return i;
  }
  this.Transform = function(b) {
    var dst = new Vector4().Set4(
      ((this.v[0] * b.m[0][0]) + (this.v[1] * b.m[1][0]) + (this.v[2] * b.m[2][0]) + (this.v[3] * b.m[3][0])),
      ((this.v[0] * b.m[0][1]) + (this.v[1] * b.m[1][1]) + (this.v[2] * b.m[2][1]) + (this.v[3] * b.m[3][1])),
      ((this.v[0] * b.m[0][2]) + (this.v[1] * b.m[1][2]) + (this.v[2] * b.m[2][2]) + (this.v[3] * b.m[3][2])),
      ((this.v[0] * b.m[0][3]) + (this.v[1] * b.m[1][3]) + (this.v[2] * b.m[2][3]) + (this.v[3] * b.m[3][3]))
    );
    return dst;
  }
  this.ToString = function () {
    var s = this.v[0].toPrecision(3) + ',' + 
            this.v[1].toPrecision(3) + ',' + 
            this.v[2].toPrecision(3);
    return s;
  }
}

if (exports != undefined) {
  exports.Matrix4 = Matrix4;
  exports.Vector4 = Vector4;
}

//
// track the head position and adjust the endpoint/target for the animation (restarting it if necessary)
// goal is to keep the head approx halfway between user and the poster
//


$scope.tethering = false;
var introbuttons = [ { name:"startButton", loc:[ 0,  0.065, 0.015], backpanel:false }];



const helperscript = document.createElement('script');
helperscript.src   = "app/resources/Uploaded/tetheredHelper.js";
document.head.appendChild(helperscript);
helperscript.onload = function(){
  
  $scope.tethered = new tetheredHelper(tml3dRenderer,  // we need to pass these in as
                                       $interval,      // they get used asycnhronously
                                       
                                       // this is an array of 'panels' to move - they can be any standard widget i.e.
                                       // model, image, label etc.  If a panel (e.g 3d) has button positioned on it, 
                                       // they ge declared here - the UI will manage the visibility to child items like
                                       // buttons during transition
                                       [
                                        // 3d panel with a button
                                        {
                                         name    : 'model-1-/', 
                                         buttons : introbuttons, 
                                         delta   : [-0.15,0.9]
                                        },
    
                                        // simple label, no buttons, but uses callbacks to control label content
                                        {
                                         name        : 'label',     
                                         buttons     : undefined   , 
                                         delta       : [ 0.15,0.6], 
                                         onMoveStart : function(t,p) { $scope.view.wdg[p.name].text='moving'; }, 
                                         onMoveEnded : function(t,p) { $scope.view.wdg[p.name].text='stopped';}
                                        }
                                       ]
                                      );
 
  //
  // when the user moves, keep track of him/her
  //
  $scope.$on('tracking', function(evt, arg) {
    
    //
    // you may already have this feature for other aspect of your application, so here you only 
    // only need to add one line to have the helper draw what it needs to draw
    //
    if ($scope.tethering) $scope.tethered.headTether(arg);
  });

}


$scope.go = function() {
  $scope.tethering = !$scope.tethering;
  $scope.view.wdg.startButton.text = $scope.tethering?"stop":"start";
}



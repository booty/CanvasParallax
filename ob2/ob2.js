window.requestAnimFrame = (function(){
	return  window.requestAnimationFrame       || 
		window.webkitRequestAnimationFrame || 
		window.mozRequestAnimationFrame    || 
		window.oRequestAnimationFrame      || 
		window.msRequestAnimationFrame     || 
		function(/* function */ callback, /* DOMElement */ element){
			window.setTimeout(callback, 1000 / 60);
		};
})();


/* ********************************************************************************************************************************************
***** OB Toolbar ******************************************************************************************************************************
*********************************************************************************************************************************************** */

var ObToolbar = function (themes) {
	this.$toolbarLinks = undefined;
	this.$activeLeaf = undefined;
	this.leafShowTimeout = undefined;
	this.leafHideTimeout = undefined;
	this.inLeaf = false;
	this.inToolbar = false;
	this.leafShowDelayMs = 500;
	this.leafHideDelayMs = 1000;
	this.leafOffset = null;
	this.$leaves=$('section.leaf');
	this.$toolbarButtons=$('#toolbar ul li');
	this.leafHideDelayMs = 750;
	this.currentTheme = undefined;
	this.canvas = document.getElementById('themeCanvas');
	this.context = this.canvas.getContext('2d');
	this.themeFieldset = $('#toolbarThemes');
	this.animationFieldset = $('#toolbarAnimationFieldset');
	
	// load cookie prefs
	this.prefs=[];
	this.prefs["toolbarAnimation"]=parseInt(jQuery.cookie('toolbarAnimation'));
	log("jQuery.cookie('toolbarAnimation')=" + jQuery.cookie('toolbarAnimation'));
	if (isNaN(this.prefs["toolbarAnimation"])) this.prefs["toolbarAnimation"]=1;
	this.prefs["theme"]=jQuery.cookie('theme');
	for (var v in this.prefs) {
		console.log('pref: ' + v + '=' + this.prefs[v]);
	}
	
	
	// position the leaves
	var $toolbar=$('#toolbar');
	this.leafOffset=$toolbar.offset();
	this.leafOffset.top += ($toolbar.outerHeight());
	$('section.leaf').offset(this.leafOffset);
	
	this.setPref=function(key,value) {
		obToolbar.prefs[key]=value;
		jQuery.cookie(key,value,{ expires: 365 });
	}
	
	this.animationFieldset.click(function(e) {	
		log('Changing animation, eh? newval=' + e.target.value);
		switch(e.target.value) {
			case '0':
				obToolbar.setPref("toolbarAnimation",0);	
				if (obToolbar.currentTheme.playing) obToolbar.pauseTheme();
				break;
			case '1':
				obToolbar.setPref("toolbarAnimation",1);	
				if (!obToolbar.currentTheme.playing) obToolbar.playTheme();
				break;
		}
	});
	
	this.themeFieldset.click(function(e) {
		log('Switching themes, eh?');
		obToolbar.setPref('theme',e.target.value);
		obToolbar.loadTheme(e.target.value);
		if (obToolbar.prefs["toolbarAnimation"])
			obToolbar.playTheme();
		else
			obToolbar.playThemeSingleFrame();
	});
		
	// create event handlers for toolbar links
	$toolBarLinks = $('#toolbar ul li a');
	for (var i=0; i<$toolBarLinks.length; i++) {
		$a = $($toolBarLinks[i]);
		$linkParent = $a.parent();
		$leaf=$($linkParent.data('leaf'));
		
		$linkParent.click(function(e) {
			e.preventDefault();
			log('you clicked the parent');
			clearTimeout(obToolbar.leafShowTimeout);
			clearTimeout(obToolbar.leafHideTimeout);
			obToolbar.showLeaf(this,'from a click');
		});
		
		$linkParent.mouseenter(function(e) {
			obToolbar.leafShowTimeout = setTimeout(function() {	obToolbar.showLeaf(e.currentTarget,'delayed show'); 		},obToolbar.leafShowDelayMs);
			clearTimeout(obToolbar.leafHideTimeout);
			obToolbar.inToolbar=true;
		});
		
		$linkParent.mouseleave(function() {
			log('Clearing show timeout');
			clearTimeout(obToolbar.leafShowTimeout);
			if (!obToolbar.inLeaf) {
				log('Setting hide timeout');
				obToolbar.leafHideTimeout = setTimeout(function() { obToolbar.hideLeaves('from button mouseleave',false,true); }, obToolbar.leafHideDelayMs);
			}
			obToolbar.inToolbar=false;
		});
		
		$leaf.mouseenter(function() { 
			log('Entering leaf, clearing hide timeout');
			clearTimeout(obToolbar.leafHideTimeout); 
			obToolbar.inLeaf=true;
		});
		
		$leaf.mouseleave(function() {
			log('Leaving leaf, settiing hide timeout');
			var that=this;
			setTimeout(function() { obToolbar.hideLeaves('from leaf mouseleave',false,true); },obToolbar.leafHideDelayMs);
			obToolbar.inLeaf=false;
		});
		
	};
	
	
	this.showLeaf = function(target,msg) {
		log('showLeaf ...' + msg + ' target.id=' + target.id);
		var $that=$(target);
		var $leaf=$($that.data('leaf'));	// selector for the leaf element is stored in the $that's "data-leaf" attribute ie <span data-leaf="#someLeafElement">Blah</span>
		
		// trying to re-show the current leaf?  hide it instead
		if ((obToolbar.$activeLeaf) && ($leaf[0]===obToolbar.$activeLeaf[0])) {
			this.hideLeaves('from showLeaf trying to re-show active leaf. hiding instead', true,true);
			return;
		}
		
		// hide the other leaves, deactivate other buttons, active this button
		this.hideLeaves('from showLeaf',true,false,target.id);
		this.$toolbarButtons.removeClass('active');
		$that.addClass('active');
		
		// only do animation if there currently is no leaf open 
		if (this.$activeLeaf==null)
			$leaf.slideDown(200);
		else
			$leaf.show();
		
		this.$activeLeaf=$leaf;
	};
	
	
	this.updateThemeUiState=function(themes, activeThemeGuid) {
		// themes
		var $themeList = $('#toolbarThemeList');
		$themeList.empty();
		for(var i in themes) {
			var active=(activeThemeGuid==themes[i].guid);
			var t=themes[i];
			$themeList.append('<li><input'+(active ? ' checked' : '')+' type=radio name=toolbarTheme value="'+t.guid+'" id=theme' + i + '></input><label for=theme' + i + '>'+ t.name + '<br><small>by ' + t.author + '</small></li>');
		}
		
		// animation toggle
		document.getElementById('toolbarAnimOn').checked=this.prefs["toolbarAnimation"];
		document.getElementById('toolbarAnimOff').checked=!this.prefs["toolbarAnimation"];
	}
	
	this.hideLeaves=function(msg,force,fade,dontHideId) {
		// display none, then reset top to 0		
		if (msg) log('hideLeaves: ' + msg);
		
		if ((this.inLeaf || this.inToolbar) && !force) {
			log('hideLeaves: not hiding; we are in a leaf');
			return;
		}
		
		if (dontHideId) {
			// hide everything BUT that id.  ie... 
			// a leaf is already open and we don't want to hide it
			// and do not animate
			$('section.leaf[id!="' + dontHideId + '"]').hide();
		}
		else {
			// no leaves are open.  hide them all and do the animation
			this.$leaves.slideUp(100);
			this.$activeLeaf=null;
			this.$toolbarButtons.removeClass('active');
		}
		
	}
	
	this.addTheme=function(obTheme, updateThemeList) {
		this.themes[obTheme.guid] = obTheme;
		if (updateThemeList) this.updateThemeUiState(this.themes);
		
		// TODO: save current theme in cookie
	}
	
	this.loadTheme=function(guid) {
		var newTheme = this.themes[guid];	// do we HAVE a theme with that GUID?

		if (newTheme) {
			// if there is an old theme, stop playing that animation (important!)
			if (this.currentTheme) {
				log('toolbar.loadTheme: unloading current theme');
				this.currentTheme.unload(); // .Unload also stops playback
				this.playingTheme=false;
			}
			//log('toolbar.loadTheme: playing new theme');
			this.currentTheme=newTheme;
			//this.playTheme();
		}
		else 
			log('No theme with guid of ' + guid);
	}
	
	
	this.pauseTheme=function() {
		if (this.currentTheme.playing) this.currentTheme.pause();
	}
	
	this.playTheme=function() {
		if ((!this.currentTheme) || (this.playingTheme)) {
			log('obToolbar.playTheme: no current theme or already playing');
			log('!this.currentTheme=' + (!this.currentTheme));
			log('this.playingTheme=' + (this.playingTheme));
			return;
		}
		this.currentTheme.play(this.canvas);	
	}
	
	// shows a single frame of the theme
	this.playThemeSingleFrame=function() {
		this.playTheme();
		this.pauseTheme();
	}
	
	// load themes into array
	this.themes=[];
	if (themes) {
		for(i=0; i<themes.length; i++) 
			this.addTheme(new ObTheme(themes[i]), false);

		// do we have a theme in the cookie (and does it exist?)
		if (this.themes[this.prefs["theme"]]) {
		  log('Loading the theme found in the cookie');
		  this.loadTheme(this.prefs["theme"]);
	  	}
		else
		  this.loadTheme(themes[0].guid);	
		
		this.updateThemeUiState(this.themes,this.currentTheme.guid);
		if (this.prefs["toolbarAnimation"]) 
			this.playTheme();
		else {
			log('Stopping theme animation because of userpref');
			this.playThemeSingleFrame();
		}
		
		// TODO: choose theme from cookie, etc
	}
	
};


/* *************************************************************************************************************************************************
***** OB Theme**************************************************************************************************************************************
************************************************************************************************************************************************** */

var FUDGE_FACTOR_MS = 5;

ObTheme = function(obj) {
	this.name = obj.name || 'Theme name goes here';
	this.author = obj.author || 'anonymous';
	this.guid = obj.guid;
	this.initialized = false;
	this.layers=[];
	this.animationIntervalMs = obj.animationIntervalMs || 30;
	for (var i in obj.layers) 
		this.layers.push(new ObThemeLayer(obj.layers[i]));
}

function animateFrame(timestamp) {
	var t = obToolbar.currentTheme;
	
	if ((t==undefined) || (!t.initialized)) {
		log('Theme not ready; skipping AnimateFrame');
		return;
	}
	
	// timestamp will be empty if we fell back to .setTimeout().  in this case, get timestamp from Date object
	if (!timestamp) timestamp = (new Date()).getTime(); 
	
	for(var i in t.layers) 
		if (t.layers[i].nextUpdate<=timestamp )
			// time for this layer to be updated and scrolled
			t.layers[i].draw(t.context, t.animationIntervalMs, true,timestamp);
		else
			// not time for this layer to be scrolled, but we have to redraw it (to handle overlapping layers)
			if (t.layers[i].drawEveryFrame) t.layers[i].draw(t.context, t.animationIntervalMs, false,timestamp);

	if (t.playing) requestAnimFrame(animateFrame,obToolbar.canvas);
}


/*	Specify the canvas, set y offsets, get context, call .Initialize() on all layers */
ObTheme.prototype.initialize = function(targetCanvas) { 
	log('Theme ' + this.name + ' initializing');
	if(targetCanvas==undefined) {
		log('Cant initialize, targetCanvas is undefined');
		return;
	}

	log('Initializing...');
	this.canvas = targetCanvas;
	this.context = targetCanvas.getContext('2d');
	// init the yoffsets. for convenience's sake, if the yoffset is -1, we'll figure it out automatically
	var totalY=-1;
	for(var i in this.layers) {
		var l = this.layers[i];
		if (l.yOffset==-1) l.yOffset = (totalY+1);	// if -1, assume they want it 1 pixel below the previous layer
		totalY+=l.heightPixels;
		l.initialize();
	}
	this.initialized=true;
	this.playing=false;
}

ObTheme.prototype.play = function(targetCanvas) {
	log('Playing theme');
	if (!this.context && targetCanvas) this.initialize(targetCanvas);
	
	log('ObTheme.play: Requesting animation frame');
	this.playing=true;
	requestAnimFrame(animateFrame,this.canvas);
}

/* Pauses animation, doesn't unload */
ObTheme.prototype.pause = function() {
	this.playing=false;
}

/* Stops animation, disposes of stuff. Is the disposal needed?!? */
ObTheme.prototype.unload = function() {
	this.playing=false;
	for (var i in this.layers) this.layers[i].cleanup();
	this.canvas=undefined;
	this.context=undefined;
}


/* *************************************************************************************************************************************************
***** OB ThemeLayer *****************************************************************************************************************************
************************************************************************************************************************************************* */

/* Contains asset and state information for one layer */
/*
ObThemeLayer = function(elementId, scrollingSpeed, widthPixels, heightPixels, yOffset, scrollingIncrementPixels, forceUpdateOnEveryFrame) {
	this.ElementId = elementId;	
	this.ScrollingSpeed = scrollingSpeed; // 0=fastest (will be scrolled on every redraw)
	this.ScrollingIncrementPixels = scrollingIncrementPixels;		// # of pixels to scroll on each update. negative if scrolling to left
	this.WidthPixels = widthPixels;	// height of the original graphic (before we repeated it)
	this.YOffset = yOffset;	// how far from the top of the window 
	this.HeightPixels = heightPixels;	
	this.NextUpdate = new Date(2000,1,1);	// when should the next update happen?
	this.CurrentXOffset = 0;	// state information - how far have we scrolled this layer?
	this.ForceUpdateOnEveryFrame = forceUpdateOnEveryFrame;
	this.DrawCount = 0;
	this.DrawDifferenceMs = 0;
}
*/

ObThemeLayer = function(obj) {
	this.elementId = obj.elementId;	
	this.scrollingSpeed = obj.scrollingSpeed || 0; 								// 0=fastest (will be scrolled on every redraw)
	this.scrollingIncrementPixels = obj.scrollingIncrementPixels || -1;	// # of pixels to scroll on each update. negative if scrolling to left
	this.widthPixels = obj.widthPixels;												// weight of the original graphic (before we repeated it)
	this.yOffset = obj.yOffset;												// how far from the top of the window 
	this.heightPixels = obj.heightPixels || 1;											// height of the original object
	this.nextUpdate = 0; //new Date(2500,1,1);											// when should the next update happen?
	this.currentXOffset = obj.currentXOffset || 0;								// how far the object needs to scroll
	this.drawEveryFrame = obj.drawEveryFrame || false;							// if true, draw every frame (should be true if it is overloapping or overlapped)
	this.drawCount = 0;
	this.drawDifferenceMs = 0;
}

ObThemeLayer.prototype.initialize = function() {
	// create a new canvas to hold this image, because canvas-->canvas copying is faster than img-->canvas
	this.canvas = document.createElement("canvas");
	this.canvas.width = (Math.floor(912/this.widthPixels) * this.widthPixels) + this.widthPixels +  this.widthPixels;
	log('Initializing layer, for element ' + this.elementId + ' set layer canvas to width ' + this.canvas.width);
	this.canvas.height = this.heightPixels;
	this.context = this.canvas.getContext('2d');
	
	/* Repeat this image horizontally.  
		Then we can just do ONE drawImage() later for this layer in the main animation loop.
		We do this because one big drawImage is faster than many small ones */
	var img = document.getElementById(this.elementId);
	if (!img) {
		log('Couldn\'t init layer ...elementId ' + this.elementId + ' not found');
		return;
	}
		
	for(x=0; x<this.canvas.width+this.widthPixels; x+=this.widthPixels) 
		this.context.drawImage(img,x,0);
		
	// saves us a tiny calculation later in the main animation loop
	if (this.scrollingIncrementPixels > 0)
		this.maxXOffset = this.widthPixels;
	else
		this.maxXOffset = 0-this.widthPixels;
}


/*	Called from the main animation loop whenever this layer needs to be drawn
	updateOffset: "true" if we're scrolling the layer and updating the NextUpdate time
	updateOffset should be false if we're just redrawing the layer in place (to handle overlapping layers, etc)	 */
ObThemeLayer.prototype.draw = function(targetContext, animationIntervalMs, updateOffset, timestamp) {
	if (!this.canvas) this.initialize();
	//log('drawing ' + this.elementId);
	targetContext.drawImage(this.canvas, this.currentXOffset ,this.yOffset);
	if (updateOffset) {
		// disable for production
		/* this.DrawCount++;
		if (this.DrawCount>1) this.DrawDifferenceMs += (timestamp - this.NextUpdate);
		if (this.DrawCount==100) {
			log('Layer ' + this.ElementId + ': after 100 frames, average miss was ' + (this.DrawDifferenceMs/this.DrawCount) + ' ms');
			this.DrawCount = 0;
			this.DrawDifferenceMs = 0;
		}*/
		
		this.nextUpdate = timestamp + (this.scrollingSpeed * animationIntervalMs) + animationIntervalMs;
		this.currentXOffset += this.scrollingIncrementPixels;
		if (Math.abs(this.currentXOffset)>this.widthPixels) this.currentXOffset=0;
	}
}

ObThemeLayer.prototype.cleanup = function() {
	log('Layer ' + this.elementId + ' cleanup');
	this.context = undefined;
	$(this.canvas).remove(); // should remove all child elements in a nifty, jquery safe way
}

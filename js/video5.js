/* 

	(As Yet Untitled) Video Player
	Christopher Giffard, 2011

	Share and Enjoy

*/
/*global HTMLVideoElement: true, captionator:true, Sizzle:true, onEvent:true, jQuery:true, readyVideo:true, clearEvent:true, _q:true */
/*jshint strict:true */
/*Tab indented, tab = 4 spaces*/

(function() {
	"use strict";

	var Video5Wrapper = function Video5Wrapper(videoObject) {
		// Check HTML5 video compatibility
		if (!(HTMLVideoElement && videoObject instanceof HTMLVideoElement)) {
			throw new Error("This object is not an instance of HTMLVideoElement, or this browser does not support HTML5 Video.");
		}

		var wrapperObject = this;
	
		// Set up default properties for this object
		this.videoObject			= videoObject;
		// UI Elements (HTMLElement)
		this.videoContainer			= null;
		this.videoUI				= null;
		this.seekBar				= null;
		this.seekBarRangeControl	= null;
		this.timeElapsedText		= null;
		this.timeRemainingText		= null;
		this.timeElapsedLabel		= null;
		this.playPauseButton		= null;
		this.fullscreenButton		= null;
		// State Values
		this.videoID				= null;
		this.currentTime			= 0;
		this.seeking				= false;
		this.videoWidth				= 0;
		this.videoHeight			= 0;
		this.lastMousePosX			= 0;
		this.lastMousePosY			= 0;
		this.rangeOffsetX			= 0;
		this.rangeOffsetY			= 0;
		this.seekBarRangeWidth		= 0;
		this.thumbPositionX			= 0;
		this.volumeControlVisible	= false;
	
		// General support functions
		this.secsToTimestamp = function secsToTimestamp(secondsInput) {
			var seconds = Math.round(secondsInput);
			var minutes = Math.floor(seconds/60);
				minutes = minutes > 0 ? minutes >= 10 ? minutes : "0" + String(minutes) : "00";
				seconds = seconds % 60 > 0 ? seconds % 60 < 10 ? "0" + String(seconds % 60) : seconds % 60  : "00";
		
			return (minutes + ":" + seconds);
		};
	
		this.generateRandomID = function generateRandomID(length) {
			length = length ? length : 20;
			var returnString = "";
			while (length > returnString.length) {
				var tmpCharType = Math.floor(3 * Math.random());
				var tmpChar = "";
				if (tmpCharType === 0) {
					tmpChar = String.fromCharCode(65 + Math.floor(26 * Math.random()));
				} else if (tmpCharType === 1) {
					tmpChar = String.fromCharCode(97 + Math.floor(26 * Math.random()));
				} else {
					tmpChar = Math.floor(10 * Math.random());
				}
			
				returnString += tmpChar;
			}
		
			return returnString;
		};

		this.AssistiveTrackSelector = function AssistiveTrackSelector(videoNode,kind) {
			// TODO: Support current userAgent language when choosing chapter markers
			// Don't display duplicate chapter markers which are equivalent chapters in different languages

			var trackID = "trackselector-" + wrapperObject.generateRandomID(32);
			var trackUI = document.createElement("div");
			var trackUILabel = document.createElement("label");
			var trackSelector = document.createElement("select");
			var selectorLabel = "Captions";
			var trackList = [];

			this.DOMNode = trackUI; // Export this and this alone
			
			trackUI.appendChild(trackUILabel);
			trackSelector.id = trackID;
			trackUILabel.setAttribute("for",trackID);
			trackUI.appendChild(trackSelector);

			if (kind !== "chapters") {
				trackSelector.blankTrackOption = document.createElement("option");
				trackSelector.blankTrackOption.setAttribute("value",-1);
				trackSelector.appendChild(trackSelector.blankTrackOption);
			}

			if (kind === "chapters") {
				selectorLabel = "Chapter";
				trackUI.className = "assistive-selector chapter-selector";
				trackUILabel.innerHTML = selectorLabel + ": <span class='chaptername state'>No Chapters</span>";
				trackList = videoNode.tracks;
				
			} else if (kind === "video") {
				selectorLabel = "Video";
				trackUI.className = "assistive-selector video-track-selector off";
				trackSelector.blankTrackOption.innerHTML = "No Video Tracks";
				trackUILabel.innerHTML = selectorLabel + ": <span class='state'>OFF</span>";
				trackList = videoNode.videoTracks;

			} else if (kind === "audio") {
				selectorLabel = "Audio";
				trackUI.className = "assistive-selector audio-track-selector off";
				trackSelector.blankTrackOption.innerHTML = "No Audio Tracks";
				trackUILabel.innerHTML = selectorLabel + ": <span class='state'>OFF</span>";
				trackList = videoNode.audioTracks;
				
			} else { // kind === "textTracks" of any variety
				trackUI.className = "assistive-selector text-track-selector off";
				trackSelector.blankTrackOption.innerHTML = "No Captions/Subtitles";
				trackUILabel.innerHTML = selectorLabel + ": <span class='state'>OFF</span>";
				trackList = videoNode.tracks;
			}

			if (kind !== "chapters") {
				for (var index in trackList) {
					if (trackList.hasOwnProperty(index)) {
						if (trackList[index].kind !== "chapters") {
							var tmpOption = document.createElement("option");
								tmpOption.setAttribute("value",index);
								tmpOption.setAttribute("title",trackList[index].label);
								tmpOption.setAttribute("selected",(trackList[index].mode===2?"selected":""));
								tmpOption.track = trackList[index];
								tmpOption.innerHTML = trackList[index].label + " (" + trackList[index].language + ")";
							
							trackSelector.appendChild(tmpOption);

							if (trackList[index].mode === 2) {
								trackUILabel.innerHTML = selectorLabel + ": <span class='state'>ON, " + tmpOption.track.language + "</span>";
								trackUI.className = trackUI.className.replace(/\b(off)\b/i,"on");
							}
						}
					}
				}
			} else {
				var chapterList = [];
				var chapterTrackCount = 0;
				var chapterTracksLoaded = 0;
				var chapterTracksProcessed = false;

				// Once all the chapter tracks have loaded, populate the chapter menu
				var populateChapterMenu = function() {
					chapterList = chapterList.sort(function(cueA, cueB) {
						if (cueA.startTime > cueB.startTime) {
							return 1;
						} else {
							return -1;
						}
					});

					chapterList.forEach(function(chapter,cueIndex) {
						var chapterTitle = String(chapter.getCueAsSource()).replace(/<[^>]+>/,"");
						var tmpOption = document.createElement("option");
							tmpOption.setAttribute("value",cueIndex);
							tmpOption.setAttribute("title",chapterTitle);
							tmpOption.setAttribute("selected",(chapter.active?"selected":""));
							tmpOption.chapter = chapter;
							tmpOption.innerHTML = (cueIndex+1) + ": " + chapterTitle;
						
						trackSelector.appendChild(tmpOption);

						if (chapter.active) {
							trackUILabel.innerHTML = selectorLabel + ": <span class='state'>" + (cueIndex+1) + ": " + chapterTitle + "</span>";
						}

						chapter.onenter = function() {
							trackUILabel.innerHTML = selectorLabel + ": <span class='state'>" + (cueIndex+1) + ": " + chapterTitle + "</span>";
							trackSelector.selectedIndex = cueIndex;
						}
					});
				}

				
				var checkChapterLoadState = function() {
					if (chapterTracksProcessed && chapterTracksLoaded >= chapterTrackCount) {
						populateChapterMenu();
					}
				};

				for (var index in trackList) {
					if (trackList.hasOwnProperty(index) && trackList[index].kind === "chapters") {
						chapterTrackCount ++;

						trackList[index].onload = function() {
							chapterTracksLoaded ++;
							trackList[index].cues.forEach(function(chapter,index) {
								chapterList.push(chapter);
							});
							checkChapterLoadState();
						};

						trackList[index].onerror = function() {
							chapterTracksLoaded ++;
							checkChapterLoadState();
						};

						trackList[index].mode = captionator.TextTrack.HIDDEN;
					}
				}

				chapterTracksProcessed = true;
				checkChapterLoadState();
			}

			onEvent(trackSelector,"change",function(eventData) {
				if (kind !== "chapters") {
					var currentOption = _q("option",trackSelector)[trackSelector.selectedIndex];
					for (var index in videoObject.tracks) {
						if (trackList.hasOwnProperty(index)) {
							if (trackList[index].kind !== "chapters") {
								trackList[index].mode = captionator.TextTrack.OFF;
							} else {
								trackList[index].mode = captionator.TextTrack.HIDDEN;
							}
						}
					}

					if (parseInt(currentOption.getAttribute("value"),10) >= 0) {
						currentOption.track.mode = captionator.TextTrack.SHOWING;

						trackUILabel.innerHTML = selectorLabel + ": <span class='state'>ON, " + currentOption.track.language + "</span>";
						trackUI.className = trackUI.className.replace(/\b(off)\b/i,"on");
					} else {
						trackUILabel.innerHTML = selectorLabel + ": <span class='state'>OFF</span>";
						trackUI.className = trackUI.className.replace(/\b(on)\b/i,"off");
					}
				} else {
					// Chapter selector mode
					var currentOption = _q("option",trackSelector)[trackSelector.selectedIndex];
					wrapperObject.videoObject.currentTime = currentOption.chapter.startTime + 0.01;
					trackUILabel.innerHTML = selectorLabel + ": <span class='state'>" + (trackSelector.selectedIndex+1) + ": " + currentOption.innerHTML + "</span>";
				}
			});

			onEvent(trackSelector,"focus",function(eventData) {
				trackUI.className += " focus";
			});

			onEvent(trackSelector,"blur",function(eventData) {
				trackUI.className = trackUI.className.replace(/(\s*\bfocus\b)/i,"");
			});
		};
		
		// Create UI
		this.createVideoUI = function createVideoUI() {
			var videoStyles = window.getComputedStyle(this.videoObject,null);
		
			// First, switch off the browser's inbuilt controls
			this.videoObject.controls = false;
		
			// Begin making our own
			this.videoID							= "video5-" + this.generateRandomID(32);
			this.videoWidth							= parseInt(videoStyles.getPropertyValue("width").replace(/[^\d]/ig,""),10);
			this.videoHeight						= parseInt(videoStyles.getPropertyValue("height").replace(/[^\d]/ig,""),10);
			this.videoContainer						= document.createElement("div");
			this.videoContainer.id					= this.videoID;
			this.videoUI							= document.createElement("div");
			this.seekBar							= document.createElement("div");
			this.videoContainer.className			= "video5-container";
			this.videoUI.className					= "videoHud";
			this.seekBar.className					= "seekBar";
			this.videoContainer.style.width			= this.videoWidth + "px";
			this.videoContainer.style.height		= this.videoHeight + "px";
			this.videoUI.style.width				= this.videoWidth + "px";
			this.videoUI.style.height				= this.videoHeight + "px";
			this.videoUI.style.zIndex				= 150;
			this.assistiveTrackSelector				= document.createElement("div");
			this.assistiveTrackSelector.className	= "assistive-track-selector";
		
			this.videoObject.parentNode.insertBefore(this.videoContainer,this.videoObject);
			this.videoContainer.appendChild(this.videoObject);
			this.videoContainer.appendChild(this.videoUI);
			this.videoUI.appendChild(this.seekBar);
			this.videoUI.appendChild(this.assistiveTrackSelector);
		
			// ARIA
			this.videoContainer.setAttribute("role","application");
			this.seekBar.setAttribute("role","progressbar");
			// more to come

			// <track> & caption support
			if (window.captionator) {
				captionator.captionify(videoObject,null,{controlHeight:30,appendCueCanvasTo:this.videoContainer});

				if (videoObject.tracks && videoObject.tracks.length) {
					// Determine if there are any chapter tracks
					if (videoObject.tracks.reduce(function(previous,current,index,array) {
							return previous || !!(current.kind === "chapters");
						},false)) {
						this.chapterSelector = new this.AssistiveTrackSelector(this.videoObject,"chapters");
						this.assistiveTrackSelector.appendChild(this.chapterSelector.DOMNode);
					}

					// Determine if there are any non-chapter tracks (captions, subtitles, etc)
					if (videoObject.tracks.reduce(function(previous,current,index,array) {
							return previous || !!(current.kind !== "chapters");
						},false)) {
						this.textTrackSelector = new this.AssistiveTrackSelector(this.videoObject,"captions");
						this.assistiveTrackSelector.appendChild(this.textTrackSelector.DOMNode);
					}
				}

				if (videoObject.audioTracks && videoObject.audioTracks.length) {
					this.audioTrackSelector = new this.AssistiveTrackSelector(this.videoObject,"audio");
					this.assistiveTrackSelector.appendChild(this.audioTrackSelector.DOMNode);
				}

				if (videoObject.videoTracks && videoObject.videoTracks.length) {
					this.videoTrackSelector = new this.AssistiveTrackSelector(this.videoObject,"video");
					this.assistiveTrackSelector.appendChild(this.videoTrackSelector.DOMNode);
				}
			}
		
			this.seekBar.innerHTML =
				'<button class="play"><span>Play</span></button>' +
				'<div class="loadprogress"><canvas width="1" height="12" /></div>' +
				'<label for="' + this.videoID + '-range" class="elapsed" title="Elapsed Time"><span>Elapsed time:</span><time>00:00</time></label>' + 
				'<div class="thumb" id="' + this.videoID + '-thumb">&nbsp;</div>' +
				'<input type="range" min="0" max="100" step="0.0001" value="0" id="' + this.videoID + '-range" class="playprogress bevelled" title="Video Seek Bar" />' +
				'<label for="' + this.videoID + '-range" class="remaining" title="Time Remaining"><span>Time remaining:</span><time>00:00</time></label>' +
				'<div class="details"><summary><label for="' + this.videoID + '-volume"><span>Audio Volume</span></label></summary>' +
				'<input type="range" min="0" max="20" value="20" id="' + this.videoID + '-volume" class="volume bevelled" title="Audio Volume" /></div>' +
				'<button class="fullscreen" /><span>Fullscreen</span></label>';
		
			this.timeElapsedText		= this.seekBar.getElementsByClassName("elapsed")[0].getElementsByTagName("time")[0];
			this.timeElapsedLabel		= this.seekBar.getElementsByClassName("elapsed")[0];
			this.timeRemainingText		= this.seekBar.getElementsByClassName("remaining")[0].getElementsByTagName("time")[0];
			this.timeRemainingLabel		= this.seekBar.getElementsByClassName("remaining")[0];
			this.playPauseButton		= this.seekBar.getElementsByClassName("play")[0];
			this.fullscreenButton		= this.seekBar.getElementsByClassName("fullscreen")[0];
			this.volumeDisclosure		= this.seekBar.getElementsByClassName("details")[0];
			this.loadProgressIndicator	= this.seekBar.getElementsByClassName("loadprogress")[0];
			this.loadProgressCanvas		= this.loadProgressIndicator.getElementsByTagName("canvas")[0];
			this.seekBarRangeControl	= document.getElementById(this.videoID + "-range");
			this.seekBarThumbControl	= document.getElementById(this.videoID + "-thumb");
			this.seekBarVolumeControl	= document.getElementById(this.videoID + "-volume");
		
			// Attach Events
			onEvent(this.playPauseButton,"click",this.playPause);
			onEvent(this.fullscreenButton,"click",this.fullscreen);
			onEvent(this.seekBarRangeControl,"change",this.rangeUpdate);
			onEvent(this.seekBarRangeControl,"mousedown",this.startSeek);
			onEvent(this.seekBarRangeControl,"mouseup",this.endSeek);
			onEvent(this.seekBarRangeControl,"keydown",this.rangeKeyPress);
			onEvent(this.seekBarThumbControl,"mousedown",this.startThumbDrag);
			onEvent(this.videoObject,"timeupdate",this.timeUpdate);
			onEvent(this.volumeDisclosure,"mousedown",this.displayVolumeControl);
			onEvent(this.seekBarVolumeControl,"focus",this.displayVolumeControl);
			onEvent(this.seekBarVolumeControl,"blur",this.displayVolumeControl);
			onEvent(this.seekBarVolumeControl,"change",this.updateVolume);
			onEvent(this.videoObject,"progress",this.updateLoadDisplay);
			onEvent(this.seekBarVolumeControl,"mousedown",this.volumeRangeClick);
			onEvent(this.seekBarVolumeControl,"mouseup",this.volumeRangeClick);
			
			// Update positioning
			this.updateUIPositioning();
		};
		
		this.updateUIPositioning = function updateUIPositioning() {
			// Sets up the width of the range input based on calculated button widths and total width of the toolbar
			var combinedWidth = 0;
			var elementsToCheck = [this.playPauseButton,this.fullscreenButton,this.volumeDisclosure,this.timeRemainingLabel];
			for (var index in elementsToCheck) {
				if (elementsToCheck.hasOwnProperty(index)) {
					var currentElement = elementsToCheck[index];
					var currentComputedWidth =  parseInt((window.getComputedStyle(currentElement,null).getPropertyValue("width")||"0px").replace(/[^\d]/g,""),10);
						currentComputedWidth += parseInt((window.getComputedStyle(currentElement,null).getPropertyValue("marginLeft")||"0px").replace(/[^\d]/g,""),10);
						currentComputedWidth += parseInt((window.getComputedStyle(currentElement,null).getPropertyValue("marginRight")||"0px").replace(/[^\d]/g,""),10);
						currentComputedWidth += parseInt((window.getComputedStyle(currentElement,null).getPropertyValue("paddingLeft")||"0px").replace(/[^\d]/g,""),10);
						currentComputedWidth += parseInt((window.getComputedStyle(currentElement,null).getPropertyValue("paddingRight")||"0px").replace(/[^\d]/g,""),10);
				
					combinedWidth += currentComputedWidth;
				}
			}
		
			this.seekBarThumbControl.style.top = this.seekBarRangeControl.offsetTop + "px";
			this.seekBarThumbControl.style.left = (this.seekBarRangeControl.offsetLeft + 1) + "px"; // include border
		
			var seekBarWidth = parseInt((window.getComputedStyle(this.seekBar,null).getPropertyValue("width")||"0px").replace(/[^\d]/g,""),10);
			this.seekBarRangeControl.style.width = ((seekBarWidth-combinedWidth)-6) + "px";
			this.seekBarRangeWidth = ((seekBarWidth-combinedWidth)-6);
			this.updateTimeDisplay();
			
			// Load progress indicator
			this.loadProgressIndicator.style.marginLeft = (this.seekBarRangeControl.offsetLeft+1) + "px";
			this.loadProgressIndicator.style.width = (this.seekBarRangeWidth-2) + "px";
			this.loadProgressCanvas.height = 12;
			this.loadProgressCanvas.width = this.seekBarRangeWidth-2;

			// Get offset of range control
			var obj = this.seekBarRangeControl;
			do {
				this.rangeOffsetX += obj.offsetLeft;
				this.rangeOffsetY += obj.offsetTop;
			} while ((obj = obj.offsetParent));
		};

		this.updateLoadDisplay = function updateLoadDisplay() {
			if (wrapperObject.loadProgressCanvas.getContext) {
				var canvasContext = wrapperObject.loadProgressCanvas.getContext("2d");
				var canvasHeight = parseInt(wrapperObject.loadProgressCanvas.height,10);
				var rangeCount = 0;

				wrapperObject.loadProgressCanvas.height = wrapperObject.loadProgressCanvas.height;
				while (rangeCount < wrapperObject.videoObject.buffered.length) {
					var startOffset = 0, endOffset = 0;
					var currentStart = wrapperObject.videoObject.buffered.start(rangeCount);
					var currentEnd = wrapperObject.videoObject.buffered.end(rangeCount);
					startOffset = Math.floor((currentStart / wrapperObject.videoObject.duration) * wrapperObject.seekBarRangeWidth-2);
					endOffset = Math.ceil((currentEnd / wrapperObject.videoObject.duration) * wrapperObject.seekBarRangeWidth-2);
					// Don't leave an ugly little nub of unfilled scrolltrack if we're within 10 pixels of the end
					endOffset = endOffset >= (wrapperObject.seekBarRangeWidth-12) ? wrapperObject.seekBarRangeWidth : endOffset;

					canvasContext.fillRect(startOffset,0,endOffset,canvasHeight);
					rangeCount ++;
				}

				// Hide loaded parts to the left of the playhead
				var playthroughOffset = Math.floor((wrapperObject.videoObject.currentTime / wrapperObject.videoObject.duration) * wrapperObject.seekBarRangeWidth-2);
				canvasContext.clearRect(0,0,playthroughOffset,canvasHeight);
			}
		};
	
		this.updateTimeDisplay = function updateTimeDisplay() {
			var progressBarComputedWidth = window.getComputedStyle(this.seekBarRangeControl,null).getPropertyValue("width");
				progressBarComputedWidth = parseInt(progressBarComputedWidth.replace(/[^\d]/g,""),10) - 12; // Take off twelve for the width of the thumb (inc. borders)
			var percentagePlaythrough = this.videoObject.ended? 1 :(this.videoObject.currentTime / this.videoObject.duration);
			var progressBarWidth = (percentagePlaythrough * progressBarComputedWidth);
			progressBarWidth = progressBarWidth > 0 ? progressBarWidth : 0;
			
			this.timeElapsedText.innerHTML = this.secsToTimestamp(Math.round(this.videoObject.duration) - Math.round(this.videoObject.currentTime));
			this.timeRemainingText.innerHTML = this.secsToTimestamp(Math.round(this.videoObject.currentTime));
			this.timeElapsedLabel.style.width = (progressBarWidth + 8) + "px";
			this.seekBarThumbControl.style.marginLeft = progressBarWidth + "px";
			this.thumbPositionX = progressBarWidth;
			this.updateLoadDisplay();
		};
	
		this.playPause = function playPause() {
			if (!wrapperObject.videoObject.paused) {
				wrapperObject.videoObject.pause();
				wrapperObject.playPauseButton.getElementsByTagName("span")[0].innerHTML = "Play";
				wrapperObject.videoContainer.className = wrapperObject.videoContainer.className.replace(/\s*playing\b/i,"");
			} else {
				wrapperObject.videoObject.play();
				wrapperObject.playPauseButton.getElementsByTagName("span")[0].innerHTML = "Pause";
			
				if (!wrapperObject.videoContainer.className.match(/\bplaying\b/i)) {
					wrapperObject.videoContainer.className = wrapperObject.videoContainer.className + " playing";
				}
			}
		};
	
		this.fullscreen = function fullscreen() {
			if (wrapperObject.videoObject.webkitEnterFullScreen && wrapperObject.videoObject.webkitSupportsFullscreen) {
				wrapperObject.videoObject.webkitEnterFullScreen();
			} else {
				if (!wrapperObject.isFullScreen) {
					wrapperObject.videoContainer.style.position = "absolute";
					wrapperObject.videoContainer.style.top = "0px";
					wrapperObject.videoContainer.style.left = "0px";
					wrapperObject.videoContainer.style.width = "100%";
					wrapperObject.videoContainer.style.height = "100%";
					wrapperObject.videoContainer.style.backgroundColor = "black";
					wrapperObject.videoContainer.style.margin = "0px !important";
				
					wrapperObject.videoObject.style.width = "100%";
					wrapperObject.videoObject.style.height = "100%";
					wrapperObject.videoUI.style.width = "100%";
					wrapperObject.videoUI.style.height = "100%";
				
					wrapperObject.isFullScreen = true;
				} else {
					wrapperObject.isFullScreen = false;
					wrapperObject.videoContainer.style.position = "inline";
					wrapperObject.videoContainer.style.top = "auto";
					wrapperObject.videoContainer.style.left = "auto";
					wrapperObject.videoContainer.style.width = wrapperObject.videoWidth + "px";
					wrapperObject.videoContainer.style.height = wrapperObject.videoHeight + "px";
					wrapperObject.videoContainer.style.backgroundColor = "black";
				}
			
				wrapperObject.updateUIPositioning();
			}
		};
	
		this.timeUpdate = function timeUpdate(eventData) {
			if (!wrapperObject.seeking) {
				wrapperObject.currentTime = wrapperObject.videoObject.currentTime;
				wrapperObject.seekBarRangeControl.value = (wrapperObject.currentTime / wrapperObject.videoObject.duration) * 100;
				wrapperObject.updateTimeDisplay();
			}
		};
	
		this.startThumbDrag = function startThumbDrag(eventData) {
			wrapperObject.lastMousePosX = eventData.pageX;
			wrapperObject.lastMousePosY = eventData.pageY;
			wrapperObject.startSeek();
			var thumbPosition = 0;
		
			var tmpWindowMousemoveEvent = onEvent(window,"mousemove",function(mouseEventData) {
				var currentPageX = mouseEventData.pageX;
				var movementDelta = currentPageX - wrapperObject.lastMousePosX;
			
				var progressBarComputedWidth = window.getComputedStyle(wrapperObject.seekBarRangeControl,null).getPropertyValue("width");
					progressBarComputedWidth = parseInt(progressBarComputedWidth.replace(/[^\d]/g,""),10) - 13; // Take off 13 for the width of the thumb (inc. borders)
					thumbPosition = movementDelta + wrapperObject.thumbPositionX > 0 ? movementDelta + wrapperObject.thumbPositionX : 0;
					thumbPosition = thumbPosition < progressBarComputedWidth ? thumbPosition : progressBarComputedWidth;
				
				var thumbPositionPercentage = thumbPosition / progressBarComputedWidth;
			
				wrapperObject.seekBarThumbControl.style.marginLeft = thumbPosition + "px";
				wrapperObject.timeElapsedLabel.style.width = (thumbPosition + 8) + "px";
				wrapperObject.videoObject.currentTime = wrapperObject.videoObject.duration * thumbPositionPercentage;
				wrapperObject.seekBarRangeControl.setAttribute("value",thumbPositionPercentage * 100);
			
				wrapperObject.timeElapsedText.innerHTML = wrapperObject.secsToTimestamp(Math.round(wrapperObject.videoObject.duration) - Math.round(wrapperObject.videoObject.currentTime));
				wrapperObject.timeRemainingText.innerHTML = wrapperObject.secsToTimestamp(Math.round(wrapperObject.videoObject.currentTime));
				wrapperObject.updateLoadDisplay();
			});
		
			var tmpWindowMouseupEvent = onEvent(window,"mouseup",function(mouseEventData) {
				clearEvent(window,"mouseup",tmpWindowMouseupEvent);
				clearEvent(window,"mousemove",tmpWindowMousemoveEvent);
				wrapperObject.video5_thumbMouseEvent = null;
				wrapperObject.endSeek();
				wrapperObject.lastMousePosX = eventData.pageX;
				wrapperObject.lastMousePosY = eventData.pageY;
				wrapperObject.thumbPositionX = thumbPosition;
			});
		};
	
		this.startSeek = function startSeek() {
			wrapperObject.seeking = true;
			if ((wrapperObject.videoWasPlaying = (!wrapperObject.videoObject.paused && !wrapperObject.videoObject.ended))) {
				wrapperObject.playPauseButton.getElementsByTagName("span")[0].innerHTML = "Play";
				wrapperObject.videoContainer.className = wrapperObject.videoContainer.className.replace(/\s*playing\b/i,"");
				wrapperObject.videoObject.pause();
			}
		};
	
		this.endSeek = function endSeek() {
			wrapperObject.seeking = false;
			if (wrapperObject.videoWasPlaying) {
				wrapperObject.videoObject.play();
				if (!wrapperObject.videoContainer.className.match(/\bplaying\b/i)) {
					wrapperObject.videoContainer.className = wrapperObject.videoContainer.className + " playing";
				}
			}
		};
	
		this.rangeUpdate = function rangeUpdate() {
			if (wrapperObject.seekBarRangeControl.value >= parseInt(wrapperObject.seekBarRangeControl.max,10) ||
				(wrapperObject.videoObject.duration / 100) * wrapperObject.seekBarRangeControl.value >= wrapperObject.videoObject.duration) {
				wrapperObject.videoObject.currentTime = wrapperObject.videoObject.duration - 0.1;
			} else {
				wrapperObject.videoObject.currentTime = (wrapperObject.videoObject.duration / 100) * wrapperObject.seekBarRangeControl.value;
			}
			wrapperObject.updateTimeDisplay();
		};

		this.rangeKeyPress = function rangeKeyPress(eventData) {
			eventData = eventData ? eventData : window.event;

			if ((eventData.keyCode >= 37 && eventData.keyCode <= 40) || eventData.keyCode === 32) {
				eventData.cancelBubble = true

				if (eventData.preventDefault) {
					eventData.preventDefault();
				}

				if (eventData.stopPropagation) {
					eventData.stopPropagation();
				}
			}

			var newTime = 0;
			var seekDistance = wrapperObject.videoObject.duration * 0.05;
				seekDistance = seekDistance <= 20 ? seekDistance : 20;
			
			if (eventData.keyCode === 37 || eventData.keyCode === 40) {
				newTime = wrapperObject.videoObject.currentTime - seekDistance;
				wrapperObject.videoObject.currentTime = newTime > 0 ? newTime : 0;
			} else if (eventData.keyCode === 38 || eventData.keyCode === 39) {
				newTime = wrapperObject.videoObject.currentTime + seekDistance;
				wrapperObject.videoObject.currentTime = newTime < wrapperObject.videoObject.duration ? newTime : wrapperObject.videoObject.duration;
			} else if (eventData.keyCode === 32) {
				wrapperObject.playPause();
			}
		};
		
		this.volumeRangeClick = function volumeRangeClick(eventData) {
			eventData.cancelBubble = true;
			eventData.preventDefault();
			eventData.stopPropagation();

			return false;
		};

		this.displayVolumeControl = function displayVolumeControl(eventData) {
			if (eventData.target === wrapperObject.volumeDisclosure) {
				eventData.preventDefault();
				eventData.cancelBubble = true;
				eventData.stopPropagation();
			}

			if (!wrapperObject.volumeControlVisible) {
				wrapperObject.volumeDisclosure.setAttribute("open","open");
				wrapperObject.volumeDisclosure.className += " open";
				wrapperObject.seekBarVolumeControl.focus();
				wrapperObject.volumeControlVisible = true;
			} else {
				if (eventData.type === "blur" || (eventData.target === wrapperObject.volumeDisclosure && eventData.type === "mousedown")) {
					wrapperObject.hideVolumeControl(eventData);
				}
			}
		};
		
		this.hideVolumeControl = function hideVolumeControl(eventData) {
			if (wrapperObject.volumeControlVisible) {
				wrapperObject.volumeDisclosure.removeAttribute("open");
				wrapperObject.volumeDisclosure.className = wrapperObject.volumeDisclosure.className.replace(/\s*\bopen\b/ig,"");
				wrapperObject.seekBarVolumeControl.blur();
				wrapperObject.volumeControlVisible = false;
			}
		};
		
		this.updateVolume = function udpateVolume(eventData) {
			wrapperObject.videoObject.volume = wrapperObject.seekBarVolumeControl.value/20;
		};
	};

	var _q = function _q(input,search) {
		search = search instanceof HTMLElement ? search : document;

		if (search.querySelectorAll) {
			return search.querySelectorAll(input);
		} else {
			if (Sizzle) {
				return Sizzle(input,search);
			} else {
				if ($) {
					return Array.prototype.slice.call($(search).find(input),0);
				} else {
					throw new Error("Video5.js relies on Sizzle.js in browsers which do not support querySelectorAll - but it wasn't found.");
				}
			}
		}
	};
	
	var onEvent = function onEvent(element,event,callback) {
		if (element.addEventListener) {
			element.addEventListener(event,callback,false);
			return callback;
		} else {
			if (element.attachEvent) {
				return element.attachEvent(event,callback);
			} else {
				element["on"+event] = callback;
				return element["on"+event];
			}
		}
	};
	
	var clearEvent = function clearEvent(element,event,pointer) {
		if (element.removeEventListener) {
			element.removeEventListener(event,pointer,false);
		} else {
			if (element.detachEvent) {
				element.detachEvent(event,pointer);
			} else {
				element["on"+event] = null;
			}
		}
	};
	
	var readyVideo = function readyVideo() {	
		var video5Objects = Array.prototype.slice.call(_q("video.video5"),0);
		for (var index in video5Objects) {
			if (video5Objects.hasOwnProperty(index)) {
				video5Objects[index] = new Video5Wrapper(video5Objects[index]);
				video5Objects[index].createVideoUI();
			}
		}
	};

	var videoReadied = false;
	onEvent(document,"readystatechange",function(eventData) {
		if (document.readyState === "complete") {
			videoReadied = true;
			readyVideo();
		}
	});

	onEvent(window,"load",function(eventData) {
		if (!videoReadied) {
			readyVideo();
		}
	});

})();
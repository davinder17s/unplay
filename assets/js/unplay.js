/**
 * Events list:
 *
 * 'unplay.buffer.ready', ({buffer, AudioSource})
 * 'unplay.updated', (deltaTime)
 * 'unplay.buffer.beforedecode', [_o.currentDataSrc]
 * 'unplay.buffer.decoded', [buffer]
 *
 * 'unplay.playlist.refresh', [displayedFiles]
 * 'unplay.playlist.item.rendered', [generatedItem]
 * 'unplay.playlist.item.removed', [file]
 * 'unplay.playlist.item.added', [file]
 * 'unplay.playlist.item.invalid', [file]
 * 'unplay.playlist.item.loading', [file]
 * 'unplay.playlist.item.loadcomplete', [file]
 *
 * 'unplay.info.reset'
 * 'unplay.stopped'
 * 'unplay.playing'
 * 'unplay.notplaying'
 * 'unplay.paused'
 * */
// String padder
String.prototype.lpad = function(padString, length) {
    var str = this;
    while (str.length < length)
        str = padString + str;
    return str;
};
var unplay = (function(){
    var _o = {
        // References
        AudioContext: null, // reference to web audio context
        AudioSource: null, // reference to source
        AudioGain: null, // reference to gain
        filterTerm: '',
        AudioTimer: 0,
        playlistFiles: [], // contains list of files to be played

        // Current playing information
        info: {
            duration: 0,
            playedTime: 0
        },

        // Element references
        elements: {
            playlistContainer: null, // contains playlist's items
            seek: null, // seek bar element
            volume: null, // volume bar element
            playerBody: null, // whole player's body
            playBtn: null,
            pauseBtn: null,
            prevBtn: null,
            nextBtn: null,
            stopBtn: null,
            playerArtistInfoContainer: null
        },

        // Timers
        tempTimer: null,

        // Caches
        AudioDecodeBuffer: null, // decoded buffer
        currentFile: null, // current file that is selected to be played
        currentDataSrc: null, // current file converted to a data source, so we can play it

        // Statuses
        isPlaying: false,

        /********************************************
         * Audio api handlers
         ********************************************/
        initContext: function(){
            // Initialize browser based audio context
            if (typeof AudioContext !== "undefined") {
                _o.AudioContext = new AudioContext();
            } else if (typeof webkitAudioContext !== "undefined") {
                _o.AudioContext = new webkitAudioContext();
            } else {
                throw new Error('AudioContext not supported. :(');
            }
            // create volume control
            _o.AudioGain = _o.AudioContext.createGain();
            _o.AudioGain.connect(_o.AudioContext.destination);
            // create dummy buffer source
            _o.AudioSource = _o.AudioContext.createBufferSource();
            // set playing status to false
            _o.isPlaying = false;
        },
        // creates buffer for playing the file
        createBuffer: function(callback){
            // handler for buffered files
            function bufferHandler(buffer) {
                _o.info.duration = buffer.duration;

                // disconnect old source
                _o.AudioSource.disconnect();

                // create new buffer source
                _o.AudioSource = _o.AudioContext.createBufferSource();
                _o.AudioSource.buffer = buffer; // set buffer

                // connect to speakers and gain
                _o.AudioSource.connect(_o.AudioContext.destination);
                _o.AudioSource.connect(_o.AudioGain);

                $(window).trigger('unplay.buffer.ready', {'buffer': buffer, 'AudioSource': _o.AudioSource});

                // after init callback
                if(typeof callback == 'function') {
                    callback()
                }
            }
            // if cached buffer exists use it.
            if(_o.AudioDecodeBuffer) {
                bufferHandler(_o.AudioDecodeBuffer);
            } else {
                // otherwise try to decode and cache it.
                if(_o.currentDataSrc) {
                    $(window).trigger('unplay.buffer.beforedecode', [_o.currentDataSrc]);
                    _o.AudioContext.decodeAudioData(_o.currentDataSrc, function(buffer){
                        $(window).trigger('unplay.buffer.decoded', [buffer]);
                        _o.AudioDecodeBuffer = buffer; // save for cached references
                        bufferHandler(buffer);
                    });
                }
            }

        },

        /*******************************************
         * Playlist handlers
         *******************************************/
        // Refresh playlist items
        refreshPlaylist: function(){
            // empty out the container before adding the list
            var displayedFiles = [];
            _o.elements.playlistContainer.empty();
            _o.playlistFiles.forEach(function(file){
                var regex = new RegExp(_o.filterTerm, 'gi');
                if(regex.test(file.name)) {
                    displayedFiles.push(file);
                    // generate template for list and append to playlist
                    $(_o.templatePlaylistItem(file)).appendTo(_o.elements.playlistContainer);
                }

            });
            if(_o.playlistFiles.length == 0) {
                var templateEmpty = '<div class="player-playlist-list-item"><div class="playlist-item-icon"></div><div class="playlist-item-name"><i class="fa fa-arrows"></i> &nbsp; Drag and Drop audio files here</div></div>';
                $(templateEmpty).appendTo(_o.elements.playlistContainer);
            }
            // Fire event
            $(window).trigger('unplay.playlist.refresh', [displayedFiles]);
        },
        // Template for filelist
        templatePlaylistItem: function(file){
            var extraClasses = [];
            if(file == _o.currentFile) {
                extraClasses.push('active');
            }
            var template = '<div class="player-playlist-list-item '+ extraClasses.join(' ') +'">' +
                '<div class="playlist-item-icon"><i class="fa fa-play"></i></div>' +
                '<div class="playlist-item-name">'+ file.name +'</div>' +
                '<div class="playlist-item-remove"><i class="fa fa-trash"></i></div>' +
                '</div>';
            var element = $(template);
            // action remove file
            element.find('.playlist-item-remove').click(function(e){
                e.preventDefault();
                _o.removeFile(file);
            });
            // action play file
            element.find('.playlist-item-icon, .playlist-item-name').click(function(e){
                e.preventDefault();
                _o.setCurrentFile(file);
                _o.refreshPlaylist();
            });

            $(window).trigger('unplay.playlist.item.rendered', [element]);
            return element;
        },
        // Remove file from playlist
        removeFile: function(file){
            var index = _o.playlistFiles.indexOf(file);
            if(index > -1) {
                // remove from list and refresh list
                _o.playlistFiles.splice(index, 1);
                $(window).trigger('unplay.playlist.item.removed', [file]);
                _o.refreshPlaylist();
            }
            // if currently playing item is removed from the playlist, then remove the reference also
            if(_o.currentFile == file) {
                // set current file references to null
                _o.setCurrentFile(null);
            }
        },
        // Add file to playlist
        addFile: function(file){
            // only accept audio file types
            if(/^audio\//.test(file.type)) {
                _o.playlistFiles.push(file);
                $(window).trigger('unplay.playlist.item.added', [file]);
            } else {
                $(window).trigger('unplay.playlist.item.invalid', [file]);
                console.warn('Invalid file type: [' + file.type + '] ' + file.name);
            }
        },
        // set current file to new file
        setCurrentFile: function(file){
            // stop currently playing file
            _o.stop();
            _o.AudioDecodeBuffer = null;
            _o.currentFile = file;

            $(window).trigger('unplay.playlist.item.selected', [file]);
            // if file refrence is empty, remove data src also
            if(file == null || !file) {
                _o.currentDataSrc = null;
            } else{
                // read the file and set cached buffer to null
                $(window).trigger('unplay.playlist.item.loading', [file]);
                $('.info-name', _o.elements.playerArtistInfoContainer).html('<i class="fa fa-refresh fa-spin"></i> Crafting music, please wait..');
                var fr = new FileReader();
                fr.onload = function(f){
                    $(window).trigger('unplay.playlist.item.loadcomplete', [file]);
                    // set current data source and play
                    _o.currentDataSrc = f.target.result;
                    _o.play();
                };
                fr.readAsArrayBuffer(file);
            }
        },

        /************************************************************
         * Main player functions like play, pause, stop, next, prev
         ***********************************************************/
        // reset information for audio
        resetInfo: function(){
            $(window).trigger('unplay.info.reset');
            _o.info.duration = 0;
            _o.info.playedTime = 0;
        },
        // stop playing
        stop: function(){
            _o.pause();
            _o.resetInfo();
            _o.updateSeekUI(0);
            _o.updatePlayerStatus();
            $(window).trigger('unplay.stopped');
            $(window).trigger('unplay.notplaying');
        },
        // start playing
        play: function(){
            // cannot play if there is no file selected.
            if(_o.currentFile == null) {
                _o.stop();
            }

            // on buffer created successfully.
            _o.createBuffer(function(){
                if(_o.isPlaying == false) {
                    try{
                        // seek parameter
                        var seekableDuration = parseFloat(_o.info.playedTime);
                        // start audio on seek
                        _o.AudioSource.start(_o.AudioContext.currentTime, seekableDuration);
                    } catch(e) {

                    }
                    _o.isPlaying = true;
                    _o.updatePlayerStatus();
                    $(window).trigger('unplay.playing');
                }
            });
        },
        // pause playing
        pause: function(){
            if(_o.isPlaying == true) {
                try{
                    _o.AudioSource.stop();
                } catch (e) {

                }
            }
            _o.isPlaying = false;
            _o.updatePlayerStatus();
            $(window).trigger('unplay.paused');
            $(window).trigger('unplay.notplaying');
        },
        // move to next item
        next: function(){
            _o.resetInfo();
            // it has more than 1 items
            if(_o.playlistFiles.length > 1){
                var currentIndex = _o.playlistFiles.indexOf(_o.currentFile);
                if(_o.playlistFiles[currentIndex + 1]){
                    // select next file
                    _o.setCurrentFile(_o.playlistFiles[currentIndex + 1]);
                    _o.refreshPlaylist();
                } else {
                    _o.stop();
                }
            } else {
                _o.stop();
            }
        },
        // move to prev item
        prev: function(){
            _o.resetInfo();
            // has more than 1 items
            if(_o.playlistFiles.length > 1){
                var currentIndex = _o.playlistFiles.indexOf(_o.currentFile);
                if(currentIndex > 0 && _o.playlistFiles[currentIndex - 1]){
                    // select previous file
                    _o.setCurrentFile(_o.playlistFiles[currentIndex - 1]);
                    _o.refreshPlaylist();
                } else {
                    _o.stop();
                }
            } else {
                _o.stop();
            }
        },

        /***********************************************
         * UI Related functions
         ************************************************/
        // get slider's current seek value
        getSeek: function(){
            return _o.elements.seek.dragSlider().getValue();
        },
        // set audio seek to a value
        setSeek: function(value){
            // set audio seek value
            clearTimeout(_o.tempTimer);
            _o.tempTimer = setTimeout(function(){
                _o.pause(); // pause for a moment
                // set seek values
                var seekableDuration = value * _o.info.duration;
                _o.info.playedTime = seekableDuration;
                // start playing again
                _o.play();
                _o.tempTimer = null;
            }, 500);

        },
        // update ui seek value to given value
        updateSeekUI: function(value){
            _o.elements.seek.dragSlider().setValue(value, false);
        },
        onSeek: function(deltaTime){
            if(_o.isPlaying == true) {
                // if user is seeking, do no update any thing
                if(_o.tempTimer){
                    return;
                }
                // if song is not ended and current play time is under duration
                if(_o.info.duration != 0 && _o.info.playedTime <= _o.info.duration + 1){
                    var percent = (_o.info.playedTime / _o.info.duration);
                    // set maximum percent value to 100% if it goes outside of it.
                    if(percent > 1) {
                        percent = 1;
                    }
                    _o.updateSeekUI(percent);
                    _o.updateDuration();
                    // add to play time: last polled time's difference
                    _o.info.playedTime += deltaTime / 1000;
                } else {
                    // otherwise forward to next song
                    _o.next();
                }
            }
        },

        // get slider's current volume value
        getVolume: function(){
            return _o.elements.volume.dragSlider().getValue();
        },
        // set slider's current volume value
        updateVolumeUI: function(value){
            _o.elements.volume.dragSlider().setValue(value, false)
        },
        // set audio volume value
        setVolume: function(value){
            // set audio volume value
            // actual gain value is from -1 to 1 so need to be offset to be between 0 and 1
            _o.AudioGain.gain.value = ((value) - 1);
            _o.changeVolumeIcon(value);
        },
        // dynamic change volume icon
        changeVolumeIcon: function(value){
            var _icon = $('i.fa', _o.elements.volumeIcon);
            if(value < 0.05) {
                _icon.removeClass('fa-volume-up');
                _icon.removeClass('fa-volume-down');
                _icon.addClass('fa-volume-off');
            } else if(value < 0.5) {
                _icon.removeClass('fa-volume-off');
                _icon.removeClass('fa-volume-up');
                _icon.addClass('fa-volume-down');
            } else {
                _icon.removeClass('fa-volume-down');
                _icon.removeClass('fa-volume-off');
                _icon.addClass('fa-volume-up');
            }
        },

        /*************************************************
         * Player status handler
         *************************************************/
        // update player status
        updatePlayerStatus: function(){
            if(_o.isPlaying == true) {
                _o.elements.controlsContainer.addClass('status-playing');
            } else {
                _o.elements.controlsContainer.removeClass('status-playing');
            }

            var infoName = $('.info-name', _o.elements.playerArtistInfoContainer);
            var infoSampleRate = $('.info-sample-rate', _o.elements.playerArtistInfoContainer);
            var infoDuration = $('.info-length', _o.elements.playerArtistInfoContainer);
            if(_o.info.duration > 0) {
                infoName.html(_o.currentFile.name);
                infoSampleRate.html(_o.AudioDecodeBuffer.sampleRate + 'Hz');
            } else {
                infoName.html(infoName.data('default'));
                infoSampleRate.html(infoSampleRate.data('default'));
                infoDuration.html(infoDuration.data('default'));
            }
        },
        updateDuration: function(){
            var playedTime = _o.info.playedTime;
            var duration  = _o.info.duration;
            if(playedTime > duration) {
                playedTime = duration;
            }
            var playtimeInfo =  parseInt(playedTime / 60).toString().lpad('0', 2) + ':' + parseInt((playedTime) % 60).toString().lpad('0', 2) + ' / '  +
                parseInt(duration / 60).toString().lpad('0', 2) + ':' + parseInt((duration) % 60).toString().lpad('0', 2);
            $('.info-length', _o.elements.playerArtistInfoContainer).html(playtimeInfo);
        },

        /*************************************************
         * Initialize all player components
         *************************************************/
        initWatcher: function(){
            var updateInterval = 300;

            _o.AudioTimer = Date.now(); // initial timer value
            var IntervalWatcher = setInterval(function(){
                deltaTime = Date.now() - _o.AudioTimer;
                // fire update event
                $(window).trigger('unplay.updated', [deltaTime]);
                // update reference time.
                _o.AudioTimer = Date.now();
            }, updateInterval);
        },
        // initialize references to elements
        setReferences: function(){
            _o.elements.playlistContainer = $('.player-playlist-list');
            _o.elements.seek = $('.seek');
            _o.elements.volume = $('.volume');
            _o.elements.playerBody = $('.player-body');
            _o.elements.controlsContainer = $('.player-controls-container');
            _o.elements.playBtn = $('.play', _o.elements.controlsContainer);
            _o.elements.pauseBtn = $('.pause', _o.elements.controlsContainer);
            _o.elements.prevBtn = $('.backward', _o.elements.controlsContainer);
            _o.elements.nextBtn = $('.forward', _o.elements.controlsContainer);
            _o.elements.stopBtn = $('.stop', _o.elements.controlsContainer);
            _o.elements.playerArtistInfoContainer = $('.player-artist-info');
            _o.elements.volumeIcon = $('.volume-icon');
        },
        // user interface initialization
        initUI: function(){
            //-- player seek control
            _o.elements.seek.dragSlider();
            _o.elements.seek.on('slider.onslide', function(e, slider){
                _o.setSeek(slider.getValue());
            });
            //-- /player seek control

            //-- player volume control
            _o.elements.volume.dragSlider();
            _o.elements.volume.on('slider.onslide', function(e, slider){
                _o.setVolume(slider.getValue());
            });
            _o.setVolume(1.0);
            _o.updateVolumeUI(1.0);
            //-- player volume control

            //-- player drag and drop handler
            _o.elements.playerBody.on('dragover', function(e){
                e.preventDefault();
            });
            _o.elements.playerBody.on('drop', function(e){
                e.preventDefault();
                $.each(e.originalEvent.dataTransfer.files, function(i, file){
                    _o.addFile(file);
                });
                if(_o.currentFile == null) {
                    _o.setCurrentFile(_o.playlistFiles[0]);
                }
                _o.refreshPlaylist();
            });
            //-- /player drag and drop handler

            //-- player controls handlers
            _o.elements.playBtn.click(function(){
                _o.play();
            });
            _o.elements.pauseBtn.click(function(){
                _o.pause();
            });
            _o.elements.stopBtn.click(function(){
                _o.stop();
            });
            _o.elements.prevBtn.click(function(){
                _o.prev();
            });
            _o.elements.nextBtn.click(function(){
                _o.next();
            });
            _o.elements.volumeIcon.click(function(){
                var _icon = $('i.fa',$(this));
                if(_icon.hasClass('fa-volume-up')) {
                    _o.setVolume(0);
                    _o.updateVolumeUI(0);
                } else {
                    _o.setVolume(1);
                    _o.updateVolumeUI(1);
                }
            });
            //-- /player controls handlers

            //-- search bar action
            $('#search').keyup(function(e){
                e.preventDefault();
                // set filter value and refresh the playlist items
                _o.filterTerm = $(this).val();
                _o.refreshPlaylist();

            });
            //-- /end search bar action

            /**
             * Update event
             */
            $(window).on('unplay.updated', function(event, deltaTime){
                _o.onSeek(deltaTime); // update seek bar with time
            });
            //-- watcher for seek

        },
        // initialize all player components
        init: function(){
            // Initialize context and interface
            _o.initContext();
            _o.setReferences();
            _o.initUI();
            _o.initWatcher();
            _o.refreshPlaylist();
            _o.updatePlayerStatus();
        }
    };
    return _o;
})();

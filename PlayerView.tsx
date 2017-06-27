import * as jQuery from "jquery";
import { GvpEvent } from '../objects/GvpEvent';
import { Constant } from '../objects/Constant';
import { Track } from '../Track';
import { View } from '../View';
import { Ratings } from '../components/Ratings';
import { VideoSubjectProperties } from '../subjects/VideoSubjectProperties';
import { PlayerSubjectProperties } from '../subjects/PlayerSubjectProperties';
import { InstanceManager } from '../../../../Core/src/classes/InstanceManager';
import { LoaderButton } from '../../../../Core/src/svgs/LoaderButton';
import { ReportHelper } from '../ReportHelper';
import * as stylesPlayer from '../../css/player.css';
import * as stylesController from '../../css/controller.css';
import * as stylesButton from '../../../../Core/src/css/button.css';
import * as stylesTranscript from '../../css/transcript.css';
import * as stylesDescription from '../../css/description.css';
import { ReplayButton } from '../../../../Core/src/svgs/ReplayButton';
import * as styles from '../../../../Components/src/css/videoComponent.css';
import { VideoComponent, CaptionComponent, PanelComponent, RangeComponent, TranscriptComponent, FeedbackComponent } from '../../../../Components/Components';
import { ThumbsUpIcon, ThumbsDownIcon, Player, Subject, Conductor, Timecode, CaptionButton, TranscriptButton, MessageIcon, FullScreenButton, VolumeButton, PlayButton, PauseButton, ClosePanelButton } from '../../../../Core/Core';
//
import 'css-element-queries';
declare var ElementQueries: any;
var ResizeSensor = require('../../../../../node_modules/css-element-queries/src/ResizeSensor.js');
var animateScrollTo = require('../../../../../node_modules/animated-scroll-to/animated-scroll-to.js');


export class PlayerView extends View {

    private playerSubject: Subject;
    private videoSubject: Subject;
    private player: Player;
    private captionComponent: CaptionComponent;
    private panel: PanelComponent;
    private transcript: TranscriptComponent;
    private feedback: FeedbackComponent;
    private ratings: Ratings;
    private ariaLiveText: string = '';
    private _forceModal: boolean;
    private _fullScreenManualTest = false; // keep track of our own full screen due to IE feature of handling esc button
    private _rating: number = null;

    /*
    component lifecyle
    ***************************/

    get html(): any {
      /** @jsx _this.parse */(() => { this; })()//Typescript solution to ensure self is captured as _this within rest of block
        return <div class={stylesPlayer.view + (this.modal ? ' ' + stylesPlayer.modal : '') + (this.fullscreen ? ' ' + stylesPlayer.fullscreen : '')} data-modal={this.modal || this.fullscreen}
            event-click={(event: Event) => {//closes modal when click on background only
                if (!this.modal)
                    return;
                if (event.target === this.element) {
                    this.close();
                }
            }}>

            <div aria-live="polite" style="position:absolute;visible:hidden;">{this.ariaLiveText}</div>
            <div class={stylesPlayer.player + (this.modal ? ' ' + stylesPlayer.modal : '') + (this.fullscreen ? ' ' + stylesPlayer.fullscreen : '')}>

                {this.closeJSX}

                <div class={stylesPlayer.viewport + (this.fullscreen ? ' ' + stylesPlayer.fullscreen : '') + (this.modal ? ' ' + stylesPlayer.modal : '')}>

                    <div style={(this.fullscreen ? 'display:none; ' : '')}
                        class={stylesPlayer.title} >{this.videoSubject.getProp('title')}</div>

                    {this.videoJSX}

                    {this.captionJSX}

                    {this.small ? this.createPanel() : ''}

                    <div class={stylesPlayer.controller + (this.fullscreen ? ' ' + stylesPlayer.fullscreen : '')} role="group">
                        {this.playBtn} {this.seekRange} {this.duration} {this.muteBtn} {this.volumeRange}{this.ccBtn}{this.transcriptBtn}{this.fullscreenBtn}
                        {this._config['ratings'] && this._config['ratings'].indexOf('inline') > -1 ? this.thumbsInlineJSX : ''}
                    </div>

                    {this._config['ratings'] ?
                        this._config['ratings'].indexOf('inline') == -1 ?
                            <Ratings id="ratings" type={this._config['ratings']} hidden={(this.player.currentTime > 5) ? false : true}></Ratings> :
                            <Ratings id="ratings" style="display:none;" transition={false} type={this._config['ratings']} hidden={(this.player.currentTime > 5) ? false : true}></Ratings>
                        : ''}
                </div>
                {this.small ? '' : this.createPanel()}
            </div>
        </div>;
    }

    protected initialize() {
        if ((this.element.parentElement.getAttribute('fullscreen') == "") || (this.element.parentElement.getAttribute('fullscreen') == "true")) {
            this.fullscreen = true;
        }
    }

    protected refreshed() {
        if (this._config['target'] && this.element) {
            let target = document.getElementById(this._config['target']);
            if (target && this.element.parentElement !== target) {
                target.appendChild(this.element);
                setImmediate(() => {//1. video doesn't keep playing when element moves 2. must wait until call play again
                    this.player.playing = true;
                });
            }
        }
    }

    protected added() {
        new ReportHelper(this.element, this.videoSubject);

        //handles Escape key for exiting modal mode, closing transcript or
        this.setupKeyboardControl();

        InstanceManager.register(this);
        InstanceManager.doToAllExceptThis(this, 'close');

        if (document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled) {
            var screen_change_events = "webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange";
            var that = this;
            jQuery(document).on(screen_change_events, function(e) {
                var event = (document.fullscreenElement) || (document.msFullscreenElement) || (document.mozFullScreen) || (document.webkitIsFullScreen) ? 'FullscreenOn' : 'FullscreenOff';
                if (event === 'FullscreenOn') {
                    that.fullscreen = true;
                    that._fullScreenManualTest = true;
                }
                else {
                    that.fullscreen = false;
                    that._fullScreenManualTest = false;
                }
            });
        } else {
            jQuery(document).on('keyup', function(evt) {
                if (evt.keyCode == 27) {
                    that.fullscreen = false;
                }
            });
        }
    }

    public invalidate(hard?: boolean, scroll?: any): void {
        super.invalidate(hard);
        if (hard) {
            let wasSmall: boolean = this.small;
            new ResizeSensor(this.element, () => {
                let different: boolean = false;
                if (!wasSmall && this.small) {
                    different = true;
                } else if (wasSmall && !this.small) {
                    different = true;
                }
                wasSmall = this.small;
                if (different) {
                    this.invalidate(true);
                }
            });
        }
        if (scroll && scroll.length) {
            animateScrollTo.default(window.scrollY + this.element.getBoundingClientRect().top +
                Math.max(this.element.offsetHeight - window.innerHeight, 0), {});
        }
    }

    /*
    public event API
    ***************************/

    public play() {
        this.player.playing = true;
    }

    public pause() {
        this.player.playing = false;
    }

    public click() {
        this.player.playing = !this.player.playing;
    }

    public close = (event?: Event) => {
        if (event)
            event.stopPropagation();
        this.fullscreen = false;
        this.dispatch('closed');
        InstanceManager.remove(this);
        this.player.playing = false;
        this.track.playFirst();
    }

    /*
    view lifecyle
    ***************************/

    public loadView(): void {
        this.conductor.clearSubjects();
        this.playerSubject = new Subject(new PlayerSubjectProperties());
        this.videoSubject = new Subject(new VideoSubjectProperties());

        this.conductor.add(this.playerSubject);
        this.conductor.add(this.videoSubject);

        this.videoSubject.subscribe(Subject.UPDATED, () => {
            this.invalidate(true);
        });
        this.loadData();
    }

    /*
    accessibility
    ***************************/

    private setupKeyboardControl(): void {
        if (this.element && this.element.parentElement) {
            this.addListener(this.element.parentElement, 'keydown', (event: any) => {
                //ignore if in input
                if ((event.target.nodeName.toLowerCase() === 'input' || event.target.nodeName.toLowerCase() === 'textarea') && event.keyCode != 27)
                    return;

                //space bar
                if (event.keyCode == 32) {
                    if (event.target.nodeName.toLowerCase() !== 'button') {
                        this.player.playing = !this.player.playing;
                        event.preventDefault();
                    }
                    return;
                }
                //arrows
                if (event.keyCode == 37 || event.keyCode == 39) {
                    if (event.target.getAttribute('role') !== 'slider') {
                        this.player.currentTime = event.keyCode == 37 ? this.player.currentTime - 2 : this.player.currentTime + 2;
                        event.preventDefault();
                        return;
                    } else {
                        let value: number = Number(event.target.getAttribute('reflect'));
                        let ratio: number = Math.ceil((100) / event.target.offsetWidth * 10);
                        if (typeof value !== 'undefined') {
                            event.target.setAttribute('value', event.keyCode == 37 ? value - ratio : value + ratio);
                            this.invalidate();
                        }
                        event.preventDefault();
                    }
                }
                if (event.keyCode == 38 || event.keyCode == 40) {
                    this.player.volume = event.keyCode == 38 ? this.player.volume + .1 : this.player.volume - .1;
                    event.preventDefault();
                    return;
                }
                //Escape
                if (event.keyCode == 27) {
                    if (this.panel && this.panel.element && jQuery(this.panel.element).has(event.target).length) {
                        this.panel.value = null;
                        jQuery(this.element).find('[aria-label="Video Transcript"]').focus();
                    } else {
                        if (!this._fullScreenManualTest) {
                            this.close();
                        }
                    }
                }
            });
        }
    }

    /*
    small modal & fullscreen getters/setters
    ***************************/

    get small(): boolean {
        if (!this.element)
            return false;
        if (this.element.offsetWidth < 500)
            return true;
    }

    get modal(): boolean {
        if (!this.element || !this.element.parentElement)
            return false;
        if (this._forceModal)
            return this._forceModal;
        if (this.fullscreen)
            return false;
        if (this.element.parentElement.offsetWidth < 450 && this.element.parentElement.getAttribute('modal') !== 'false')
            return true;
        return false;
    }

    set fullscreen(input: boolean) {
        if (!this.element)
            return;
        if (input) {
            if (this.element.requestFullscreen) {
                this.element.requestFullscreen(); // IE
            } else if (this.element['msRequestFullscreen']) {
                this.element['msRequestFullscreen'](); // IE 11
            } else if (this.element['mozRequestFullScreen']) {
                this.element['mozRequestFullScreen'](); // Firefox
            } else if (this.element['webkitRequestFullscreen']) {
                this.element['webkitRequestFullscreen'](); // Chrome and Safari
            } else {
                this._forceModal = true;
            }
        } else {
            if (this._forceModal) {
                this._forceModal = false;
            } else if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document['msExitFullscreen']) {
                document['msExitFullscreen']();
            } else if (document['mozCancelFullScreen']) {
                document['mozCancelFullScreen']();
            } else if (document['webkitCancelFullScreen']) {
                document['webkitCancelFullScreen']();
            }
        }
        this.invalidate();
    }

    get fullscreen(): boolean {
        if (this._forceModal) {
            return true;
        } else if (typeof document.fullscreenEnabled !== 'undefined') {
            return (document.fullscreenEnabled && document.fullscreenElement === this.element);
        } else if (typeof document.webkitFullscreenEnabled !== 'undefined') {
            return (document.webkitFullscreenEnabled && document.webkitFullscreenElement === this.element);
        } else if (typeof document['mozFullScreenEnabled'] !== 'undefined') {
            return (document['mozFullScreenEnabled'] && document['mozFullScreenElement'] === this.element);
        } else if (typeof document['msFullscreenEnabled'] !== 'undefined') {
            return (document['msFullscreenEnabled'] && document['msFullscreenElement'] === this.element);
        }
        return false;
    }

    /*
    private getters setters
    ***************************/

    private get rating(): number {
        if (this.ratings)
            return this.ratings.rating;
        return 0;
    }

    // added to remove duplicate source
    //issue fond on https://www.att.com/esupport/article.html#!/wireless/KM1025834 for video id 4200036
    private getSource(): any {
        let arr = this.videoSubject.getProp('source');
        arr = arr.filter(function(item: any, index: any, inputArray: any) {
            return inputArray.indexOf(item) == index;
        });
        return arr;
    }

    /*
    JSX/template creation helpers
    ***************************/

    private get videoJSX(): any {
        /** @jsx _this.parse */(() => { this; })()//Typescript solution to ensure self is captured as _this within rest of block
        return <VideoComponent id="player"
            event-click={(event: Event) => { this.player.playing = !this.player.playing; }}
            class={stylesPlayer.video + (this.fullscreen ? ' ' + stylesPlayer.fullscreen : '') + (this.modal ? ' ' + stylesPlayer.modal : '')}
            source={this.getSource()}
            sourceTypes={this.videoSubject.getProp('sourceTypes')}
            volume=".75"
            track={this.track}
            cards={this.videoSubject.getProp('cards')}
            textTracks={this.videoSubject.getProp('captions')}
            autoPlay>
            {this.player ?
                <div class={styles.videoOverlay} style={{ display: this.player.playing ? 'none' : 'inline' }}>
                    {(() => {
                        if (!this.player.isAtEnd) {
                            if (this.player.isLoading) {
                                return <div class={styles.loaderButton}>{LoaderButton.jsx(this.parse)}</div>;
                            } else {
                                return <div class={styles.playButton}>{PlayButton.jsx(this.parse)}</div>;
                            }
                        }
                    })()}
                    {this.player && this.player.isAtEnd ?
                        <div class={stylesPlayer.endScreen}>
                            <div class={stylesPlayer.endScreenSection}>
                                Replay
                                <button class={stylesPlayer.endScreenIcon}
                                    event-click={(event: Event) => {
                                        event.stopPropagation();
                                        this.player.replay();
                                    }} >
                                    {ReplayButton.jsx(this.parse)}
                                </button>
                            </div>
                            {this.ratings && !this.ratings.submitted ?
                                <div class={stylesPlayer.endScreenSection} event-click={(event: Event) => { event.stopImmediatePropagation() }}>
                                    Rate Video
                                {this.ratings ? this.ratings.genRatings(stylesPlayer.endScreenIcon) : ''}
                                </div> : ''
                            }
                        </div> : ''}
                </div>
                : ''}
        </VideoComponent>
    }

    private get thumbsInlineJSX(): any {
        /** @jsx _this.parse */(() => { this; })()//Typescript solution to ensure self is captured as _this within rest of block
        return (<div><button class={stylesController.button + (this.rating === 5 ? ' ' + stylesButton.gvpButtonDown : '')}
            event-click={(event: Event) => {
                this.ratings.rate(5);
                if (this.panel.value != Ratings)
                    this.panel.value = Ratings;
                this.invalidate();
            }}
            aria-label="Thumbs Up"
            report-title="Thumbs up">
            {(() => {
                return ThumbsUpIcon.jsx(this.parse);
            })()}
        </button>
            <button class={stylesController.button + (this.rating === 1 ? ' ' + stylesButton.gvpButtonDown : '')}
                event-click={(event: Event) => {
                    this.ratings.rate(1);
                    if (this.panel.value != Ratings)
                        this.panel.value = Ratings;
                    this.invalidate();
                }}
                aria-label="Thumbs Down"
                report-title="Thumbs down">
                {(() => {
                    return ThumbsDownIcon.jsx(this.parse);
                })()}
            </button></div> as any).children;
    }

    private get captionJSX(): any {
        /** @jsx _this.parse */(() => { this; })()//Typescript solution to ensure self is captured as _this within rest of block
        return <CaptionComponent id="captionComponent"
            caption={this.videoSubject.getProp('captions')}
            value={(this.player ? this.player.currentTime : 0)}
            textTrack={this.player ? this.player.textTrack : null}>
        </CaptionComponent>
    }

    private get closeJSX(): any {
        /** @jsx _this.parse */(() => { this; })()//Typescript solution to ensure self is captured as _this within rest of block
        return <button id="closeVideo" event-click={this.close}
            class={stylesPlayer.closeButton + (this.modal ? ' ' + stylesPlayer.modal : '')}
            style={(this.fullscreen ? 'display:none;' : '')}
            title="Close Video"
            arial-label="Close Video">{ClosePanelButton.jsx(this.parse)}</button>
    }

    private get playBtn(): any {
        return <button class={stylesController.button}
            event-click={(event: Event) => {
                if (this.player.isAtEnd) {
                    this.player.replay();
                } else {
                    this.player.playing = !this.player.playing;
                }
            }}
            aria-label='Play Pause'
            report-title={this.player && this.player.playing ? 'Pause Button' : 'Play Button'}
            title={this.player && this.player.playing ? 'Video is Playing' : 'Video is Paused'}
            aria-pressed={this.player && this.player.playing ? 'true' : 'false'}>
            {(() => {
                if (this.player && this.player.playing) {
                    return PauseButton.jsx(this.parse);
                } else {
                    return PlayButton.jsx(this.parse);
                }
            })()}
        </button>
    }

    private get duration(): any {
        /** @jsx _this.parse */(() => { this; })()//Typescript solution to ensure self is captured as _this within rest of block
        return <div class={stylesController.text}>
            {this.player ? Timecode.secondsToTimecode(this.player.totalTime) : ''}
        </div>;   
    }
    
    private get seekRange(): any {
        return <RangeComponent class={stylesController.range + ' ' + stylesController.seek + ' ' + stylesController.first}
            reflect={(this.player ? Math.round((this.player.currentTime / this.player.totalTime) * 100) : 0)}
            update={(value: number) => {
                if (this.player) this.player.currentTime = value / 100 * this.player.totalTime;
            } }
            tooltip="true"
            tooltipFormat="TIMECODE"
            title="Seek Video"
            report-title='Seek Slider'
            aria-label="Seek Video" role="slider" aria-valuenow={this.player ? Math.round(this.player.currentTime) : 0} aria-valuetext={this.player ? Timecode.secondsToSpeech(this.player.currentTime) : '0 Seconds'} aria-valuemin="0" aria-valuemax={this.player ? this.player.totalTime : 0}>
        </RangeComponent>
    }

    private get muteBtn(): any {
        return <button class={stylesController.button}
            event-click={(event: Event) => { this.player.muted = !this.player.muted }}
            aria-label='Mute Video'
            report-title='Mute Toggle'
            title={(this.player && this.player.volume) > 0 ? 'Video Unmuted' : 'Video Muted'}
            aria-pressed={(this.player && this.player.volume) > 0 ? 'false' : 'true'}>
            {(() => {
                return VolumeButton.jsx(this.parse, this.player ? this.player.volume > 0 ? this.player.volume : this.player.muted ? 0 : .001 : 0);
            })()}
        </button>
    }

    private get volumeRange(): any {
        return this.player.canChangeVolume ?
            <RangeComponent class={stylesController.range + ' ' + stylesController.volume}
                reflect={(this.player ? Math.round(this.player.volume * 100) : 0)}
                update={(value: number) => {
                    if (this.player) this.player.volume = value / 100;
                }}
                title="Video Volume"
                report-title='Volume Slider'
                aria-label="Video Volume" role="slider" aria-valuenow={this.player ? (this.player.volume * 100) : 0} aria-valuetext={this.player ? (this.player.volume * 100) + '%' : '0%'} aria-valuemin="0" aria-valuemax="100">
            </RangeComponent> : '';
    }

    private get ccBtn(): any {
        return <button class={stylesController.button + ((this.captionComponent && this.captionComponent.showing) ? ' ' + stylesButton.gvpButtonDown : '')}
            event-click={(event: Event) => { if (this.captionComponent) this.captionComponent.showing = !this.captionComponent.showing; }}
            aria-label="Closed Captions"
            report-title='Captions Toggle'
            title={(this.captionComponent && this.captionComponent.showing) ? 'Closed Captions On' : 'Closed Captions Off'}
            aria-pressed={(this.captionComponent && this.captionComponent.showing) ? 'true' : 'false'}>
            {(() => {
                return CaptionButton.jsx(this.parse);
            })()}
        </button>
    }

    private get fullscreenBtn(): any {
        return <button class={stylesController.button + (this.fullscreen ? ' ' + stylesButton.gvpButtonDown : '')}
            event-click={(event: Event) => { this.fullscreen = !this.fullscreen; }}
            aria-label="Fullscreen Video"
            title="Fullscreen Video"
            report-title='Full screen Toggle'
            aria-pressed={this.fullscreen ? 'true' : 'false'}>
            {(() => {
                return FullScreenButton.jsx(this.parse, this.fullscreen);
            })()}
        </button>
    }

    private get transcriptBtn(): any {
        return <button class={stylesController.button + ((this.panel && this.panel.value === TranscriptComponent) ? ' ' + stylesButton.gvpButtonDown : '')}
            event-click={(event: Event) => { if (this.panel) this.panel.value = TranscriptComponent; }}
            aria-label="Video Transcript"
            report-title="Transcript Toggle"
            aria-expanded={(this.panel && this.panel.value === TranscriptComponent) ? 'true' : 'false'}
            aria-controls="gvpTranscriptPanel"
            title={(this.panel && this.panel.value === TranscriptComponent) ? 'Transcript Open' : 'Transcript Closed'}
        >
            {(() => {
                return TranscriptButton.jsx(this.parse, this.panel ? this.panel.value === TranscriptComponent : false);
            })()}
        </button>
    }

    private createPanel() {
         /** @jsx _this.parse */(() => { this; })()
        return <PanelComponent id="panel" class={stylesPlayer.panel + (this.fullscreen ? ' ' + stylesPlayer.fullscreen : '') + (this.modal ? ' ' + stylesPlayer.modal : '')}>
            {this.panel && this.panel.value === TranscriptComponent ?
                this.transcriptComponent()
                : ''}
            {this.panel && this.panel.value === Ratings ?
                this.ratings.genCommentsPanel() : ''}
        </PanelComponent>
    }

    private transcriptComponent() {
        return <TranscriptComponent id="transcript"
            captiondata={this.videoSubject.getProp('captions')}
            value={(this.player ? this.player.currentTime : 0)}
            printTitle={this.videoSubject.getProp('title')}
            duration={this.videoSubject.getProp('duration')}
            date={this.videoSubject.getProp('date')}
            thumbIcon={this.videoSubject.getProp('thumbIcon')}
            update={(value: number) => {
                if (this.player) this.player.currentTime = value;
            }}>
        </TranscriptComponent>
    }

}
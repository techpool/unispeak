/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

import React, { Component } from 'react';

import {
    AppRegistry,
    StyleSheet,
    Text,
    View,
    TouchableHighlight,
    Platform,
    PermissionsAndroid,
    Picker
} from 'react-native';

// import Sound from 'react-native-sound';
import { AudioRecorder, AudioUtils } from 'react-native-audio';
var FileUpload = require('NativeModules').FileUpload;
import Tts from 'react-native-tts';
var languageList = require('./languages.json');

const instructions = Platform.select({
    ios: 'Press Cmd+R to reload,\n' +
        'Cmd+D or shake for dev menu',
    android: 'Double tap R on your keyboard to reload,\n' +
        'Shake or press menu button for dev menu',
});

export default class App extends Component < {} > {

    state = {
        currentTime: 0.0,
        recording: false,
        stoppedRecording: false,
        finished: false,
        audioPath: AudioUtils.DocumentDirectoryPath + '/test.aac',
        hasPermission: undefined,
        language: 'en-US',
        targetLanguage: 'en-US',
        originalData: '',
        translatedData: ''
    };

    prepareRecordingPath(audioPath) {
        AudioRecorder.prepareRecordingAtPath(audioPath, {
            SampleRate: 44100,
            Channels: 1,
            AudioQuality: "Low",
            AudioEncoding: "aac"
        });
    }

    componentDidMount() {
        this._checkPermission().then((hasPermission) => {
            this.setState({ hasPermission });

            if (!hasPermission) return;

            this.prepareRecordingPath(this.state.audioPath);

            AudioRecorder.onProgress = (data) => {
                this.setState({ currentTime: Math.floor(data.currentTime) });
            };

            AudioRecorder.onFinished = (data) => {
                // Android callback comes in the form of a promise instead.
                if (Platform.OS === 'ios') {
                    this._finishRecording(data.status === "OK", data.audioFileURL);
                }
            };
        });
    }

    doUpload(filePath) {

        var that = this;
        let files = [{
                name: 'audio',
                filename: 'test_audio_sample',
                filepath: filePath, // image from camera roll/assets library
                filetype: 'audio/aac',
            }
        ];

        let opts = {
            uploadUrl: 'http://139.59.19.228:3000/audio',
            files: files,
            method: 'POST', // optional: POST or PUT
            headers: { 'Accept': 'application/json' }, // optional
            fields: { 'user_id': '1', 'language': this.state.language, 'targetLanguage': this.state.targetLanguage }, // optional
        };

        FileUpload.upload(opts, (err, response) => {
            if (err) {
                console.warn(err);
                return;
            }

            let status = response.status;
            let responseString = response.data;
            let json = JSON.parse(responseString);

            that.originalData = json.originalData;
            that.translatedData = json.targetData;
            that.targetLanguage = 
            Tts.setDefaultLanguage(json.targetLanguage);
            Tts.speak(json.targetData);
            console.warn('upload complete with status ' + status);
        });
    }

    _replay() {
        Tts.speak(this.translatedData);
    }

    _checkPermission() {
        if (Platform.OS !== 'android') {
            return Promise.resolve(true);
        }

        const rationale = {
            'title': 'Microphone Permission',
            'message': 'AudioExample needs access to your microphone so you can record audio.'
        };

        return PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, rationale)
            .then((result) => {
                console.log('Permission result:', result);
                return (result === true || result === PermissionsAndroid.RESULTS.GRANTED);
            });
    }

    _renderButton(title, onPress, active) {
        var style = (active) ? styles.activeButtonText : styles.buttonText;

        return (
            <TouchableHighlight style={styles.button} onPress={onPress}>
          <Text style={style}>
            {title}
          </Text>
        </TouchableHighlight>
        );
    }

    async _pause() {
        if (!this.state.recording) {
            console.warn('Can\'t pause, not recording!');
            return;
        }

        this.setState({ stoppedRecording: true, recording: false });

        try {
            const filePath = await AudioRecorder.pauseRecording();

            // Pause is currently equivalent to stop on Android.
            if (Platform.OS === 'android') {
                this._finishRecording(true, filePath);
            }
        } catch (error) {
            console.error(error);
        }
    }

    async _stop() {
        if (!this.state.recording) {
            console.warn('Can\'t stop, not recording!');
            return;
        }

        this.setState({ stoppedRecording: true, recording: false });

        try {
            const filePath = await AudioRecorder.stopRecording();

            if (Platform.OS === 'android') {
                this._finishRecording(true, filePath);
            }
            return filePath;
        } catch (error) {
            console.error(error);
        }
    }

    async _play() {
        if (this.state.recording) {
            await this._stop();
        }

        // These timeouts are a hacky workaround for some issues with react-native-sound.
        // See https://github.com/zmxv/react-native-sound/issues/89.
        setTimeout(() => {
            var sound = new Sound(this.state.audioPath, '', (error) => {
                if (error) {
                    console.log('failed to load the sound', error);
                }
            });

            setTimeout(() => {
                sound.play((success) => {
                    if (success) {
                        console.log('successfully finished playing');
                    } else {
                        console.log('playback failed due to audio decoding errors');
                    }
                });
            }, 100);
        }, 100);
    }

    async _record() {
        if (this.state.recording) {
            console.warn('Already recording!');
            return;
        }

        if (!this.state.hasPermission) {
            console.warn('Can\'t record, no permission granted!');
            return;
        }

        if (this.state.stoppedRecording) {
            this.prepareRecordingPath(this.state.audioPath);
        }

        this.setState({ recording: true });

        try {
            const filePath = await AudioRecorder.startRecording();
        } catch (error) {
            console.error(error);
        }
    }

    _finishRecording(didSucceed, filePath) {
        this.setState({ finished: didSucceed });
        console.log(`Finished recording of duration ${this.state.currentTime} seconds at path: ${filePath}`);
        this.doUpload(filePath);
    }

    render() {

        var that = this;
        return (
            <View style={styles.container}>
              <View style={styles.controls}>
                <Picker
                  style={{width: 200, color: 'white' }} 
                  selectedValue={ this.state.language }
                  onValueChange={(itemValue, itemIndex) => this.setState({language: itemValue})}>
                    {
                      languageList.map((eachLanguage, index) => {
                        return (<Picker.Item key={index} label={eachLanguage.Language} value={eachLanguage.languageCode} />)
                      })
                    }
                </Picker>
                {this._renderButton("RECORD", () => {this._record()}, this.state.recording )}
                {this._renderButton("STOP", () => {this._stop()} )}
                <Text style={styles.progressText}>{this.state.currentTime}s</Text>
                <Picker
                  style={{ width: 200, color: 'white'}} 
                  selectedValue={ this.state.targetLanguage }
                  onValueChange={(itemValue, itemIndex) => this.setState({targetLanguage: itemValue})}>
                    {
                      languageList.map((eachLanguage, index) => {
                        return (<Picker.Item key={index} label={eachLanguage.Language} value={eachLanguage.languageCode} />)
                      })
                    }
                </Picker>
                { 
                    (function() {
                        if (that.state.originalData.length > 0) {
                            return (<Text style={{fontSize: 20, color: 'white'}}>{that.state.originalData}</Text>)
                        } else {
                            return (null)
                        }
                    })()
                    
                }

                {
                    (function() {
                        if (that.state.translatedData.length > 0) {
                            <Text style={{fontSize: 20, color: 'white'}}>{that.state.translatedData}</Text>    
                            that._renderButton("REPLAY", () => {that._replay()} )
                        } else {
                            return (null)
                        }
                    })()
                }
              </View>
            </View>
        );
    }
}

var styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#2b608a",
    },
    controls: {
        justifyContent: 'center',
        alignItems: 'center',
        flex: 1,
    },
    progressText: {
        paddingTop: 50,
        fontSize: 50,
        color: "#fff"
    },
    button: {
        padding: 20
    },
    disabledButtonText: {
        color: '#eee'
    },
    buttonText: {
        fontSize: 20,
        color: "#fff"
    },
    activeButtonText: {
        fontSize: 20,
        color: "#B81F00"
    }

});
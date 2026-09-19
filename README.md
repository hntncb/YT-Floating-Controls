# Youtube-Floating-Controls
YT Floating Controls Chrome Extention
# YT Floating Controls

## Project Overview
YT Floating Controls is a Google Chrome extension designed to provide a pop-up Picture-in-Picture window for controlling video and music playback on YT and YT Music. The extension allows users to manage media playback seamlessly without keeping the main browser tab in focus.

## AI Generation Notice
This project was built through a collaborative effort where the user provided the functional requirements, while Claude (an AI assistant by Anthropic) generated all source code, architecture design, and documentation.

## Features
- **Floating Controls Window**: Operates using the Chrome Document Picture-in-Picture API to present media controls in an overlay window.

<img width="171" height="221" alt="icon" src="https://github.com/user-attachments/assets/d00edc15-8669-45da-a51e-ea446bc418b3" />

<img width="444" height="122" alt="overlay" src="https://github.com/user-attachments/assets/540b5a86-7775-4ffc-bcd1-0af310353fb4" />

- **Playback Management**: Provides functional buttons for play, pause, previous track, and next track.
- **Seek Bar and Speed Control**: Displays playback progress with interactive seeking capabilities, alongside speed adjustment settings ranging from 0.25x to 2.0x.
- **Loop Toggle**: Allows users to repeat current playback seamlessly.
- **Dynamic Queue Management**:


  <img width="312" height="261" alt="toggle" src="https://github.com/user-attachments/assets/a34d266a-9c5a-424b-80d4-0c86afb1d139" />

  - **History Items**: Always retains and displays recently played tracks in the current session.
  - **Up Next Queue**: Displays upcoming tracks when active within a Mix or playlist context.
- **Activity Logging**: Logs user interaction data and supports exporting history records as a text file.

## Technical Details
- **Manifest Version**: 3
- **Minimum Chrome Version**: 116
- **Permissions**: `storage`, `downloads`
- **Supported Domains**: `https://www.YT.com/*`, `https://music.YT.com/*`

## File Structure
- `manifest.json`: Extension configuration and metadata.
- `background.js`: Service worker managing session storage permissions and file download tasks.
- `content.js`: Main execution script managing video element detection, PIP window creation, queue updates, and media event synchronization.

## Installation via Developer Mode
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle switch located in the top-right corner.

<img width="244" height="175" alt="onmode" src="https://github.com/user-attachments/assets/2ede9492-f4ba-4157-8c3a-43cd262180cf" />


3. Click the **Load unpacked** button in the top-left area.

<img width="391" height="196" alt="load" src="https://github.com/user-attachments/assets/699c50ec-266e-4c53-8370-9f2901700049" />


4. Select the unzip project directory containing `manifest.json`, `background.js`, and `content.js`.

<img width="483" height="222" alt="select" src="https://github.com/user-attachments/assets/09e6c872-8e8d-4e13-887a-66f4baa95d86" />


5. Open YT or YT Music to use the floating controls.

## License
This project is licensed under the MIT License - see the `LICENSE` file for details.

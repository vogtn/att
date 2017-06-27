# Rich Media Apps
This repo contains the GVP Rich Media team's applications. 

### Development Setup:
* Cloning Repo locally

1.  Gain code cloud access to https://codecloud.web.att.com/ via https://aod.web.att.com/dashboard?theme=blue

2.  Get added to rich media project https://ch112h@codecloud.web.att.com/scm/~ch112h/richmediaapps.git

#### SourceTree

3.  Download and setup SourceTree

4.  Clone Team Repo to local machine

        ### OR

#### Git

3. install git (homebrew or wget)

4. grab https link from the code cloud

5. run `git clone `  followed by the https link

### IDE

1. Try out Atom https://atom.io/

2. Install more packages such as atom-terminal & atom-typescript

### Node JS & NPM

1. Install Node JS, http://treehouse.github.io/installation-guides/mac/node-mac.html
    determine if node is installed in terminal type `node -v` to output version

2. Install NPM use `NPM -version` to output version

3. Confirm current working subdirectory contains "package.json" file in terminal and type `npm install`

### Build and Run locally

1. After `npm install` make changes to the component or App as necessary

2. Run `node build` followed by app you wish to build e.g. `node build gvp`

3. Additionally run `node server.js` and let server run idle

4. Visit localhost:9091 in your browser followed by app directory e.g. http://localhost:9091/pages/gvp/index.html
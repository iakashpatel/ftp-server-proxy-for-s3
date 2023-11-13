# SFTP Server which forward files to S3

## Prerequisite

- Nodejs
- NPM/Yarn

## Setup

1. clone this repo
2. copy `.env.example` as `.env` and add your aws credentials into `.env` file
3. install packages using: ` npm install`` or  `yarn install`

## Run

1. run sftp server using this command: `node server.js`
2. on new terminal tab start api-server to manage users using this command: `node api-server.js`

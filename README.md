# StudyRoomReserverServer

Reserves rooms automatically based on the Springshare library software. Server application that reserves the rooms and handles cloud messaging notifications.

Notes:
Use Node.JS vesion 6.x
Use node_modules from this folder, the newer versions cause some problems with Promises among other things.

curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs

Doesn't confirm the room was reserved, just assumes and stores in DB...

Created late Jan. 2017
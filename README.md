# StudyRoomReserverServer

Reserves rooms automatically based on the Springshare library software. Server application that reserves the rooms and handles cloud messaging notifications.

Notes:
Use Node.JS vesion 6.x
Use node_modules from this folder, the newer versions cause some problems with Promises among other things.

curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs

Doesn't confirm the room was reserved, just assumes and stores in DB...

Not partitioned, so the app only works for one group of users... Some of the base exists to partition it out though.

Need to switch some of the remaining "deasync" stuff to Promises... Was initially written when I was learning, so it's kind of messy.

Really messy, but mostly works.

Created late Jan. 2017

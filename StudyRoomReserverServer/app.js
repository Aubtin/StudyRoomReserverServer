/*
    Notes:
    Time saved in UTC, but checks are done in PST. Should be fine, since the
*/
var admin = require('firebase-admin');
var request = require('request');
var $ = require('jquery');
var jsdom = require("jsdom");
require('./date');
var secretInfo = require("./secretKeys");

//TODO: Get rid of this.
var deasync = require('deasync')

//Array Constants
const ROOMNUMBERS = ['200H', '200I', '200J', '200G', '100E'];
const TIMES = ['8:00am', '8:30am', '9:00am', '9:30am', '10:00am', '10:30am', '11:00am', '11:30am', '12:00pm', '12:30pm',
    '1:00pm', '1:30pm', '2:00pm', '2:30pm', '3:00pm', '3:30pm', '4:00pm', '4:30pm', '5:00pm', '5:30pm', '6:00pm', '6:30pm',
    '7:00pm', '7:30pm', '8:00pm', '8:30pm', '9:00pm'];
//Date library is taking 12:00 PM and 12:30 PM as AM... Fixing it here as bandaid.
const TIMESBANDAID = ['8:00am', '8:30am', '9:00am', '9:30am', '10:00am', '10:30am', '11:00am', '11:30am', '12:00am', '12:30am',
    '1:00pm', '1:30pm', '2:00pm', '2:30pm', '3:00pm', '3:30pm', '4:00pm', '4:30pm', '5:00pm', '5:30pm', '6:00pm', '6:30pm',
    '7:00pm', '7:30pm', '8:00pm', '8:30pm', '9:00pm'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

//Time
const TIMEZONE = "America/Los_Angeles";
var currentDate = new Date();
console.log("Time: " + currentDate);
console.log("Time by Time Zone: " + getCurrentTimeByTimeZone());

// Fetch the service account key JSON file contents
var serviceAccount = require("./serviceAccountRoomRequest.json");

// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: secretInfo.firebaseURL
});
ref = admin.database().ref();

function monitorPastTimeBlock() {
    ref.child('groups').child('xX2SmBz9ftb').child('reserved').once('value').then(function (snapshot) {
        console.log("Checking for past reservations...");
        snapshot.forEach(function (snapshotMain) {
            snapshotMain.forEach(function (snapshotEach) {
                console.log("Checking past reservation.");
                //Remove if key is older time than current. 
                var currentTimeDate = getCurrentTimeByTimeZone();
                // console.log("CurrentTimeDate: ")
                // console.log("Current: " + currentTimeDate.valueOf().toString() + " SnapshotTime: " + (Number(snapshotEach.key) + 1800000))
                if (currentTimeDate.valueOf().toString() > (Number(snapshotEach.key) + 1800000)) {
                    console.log(snapshotEach.key + " expired at " + currentTimeDate.valueOf().toString() + ".");
                    snapshotEach.ref.remove();
                }
            });
        });
    });
}

function isReservedInDB(prefRoom, date, startTime, endTime) {
    return new Promise(function (resolve, reject) {
        console.log("Going to begin checking for reserved in DB.");
        var exists;
        var dateL = new Date(date.valueOf());
        var room = prefRoom;
        var dbArrayResults = [];

        //Just checking the first one, because if the first exists, it's assumed to exist.
        admin.database().ref().child('groups').child('xX2SmBz9ftb').child('reserved').once('value').then(function (snapshot) {
            if (snapshot.exists() == false) {
                var resolveHolder = [false, dateL];
                resolve(resolveHolder);
                return;
            }

            snapshot.forEach(function (snapshotMain) {
                snapshotMain.forEach(function (snapshotEach) {
                    dbArrayResults.push(snapshotEach.val());
                });
            });
            var resolveHolder = [alreadyExistsChecker(dbArrayResults, room, dateL, startTime, endTime), dateL];
            resolve(resolveHolder);
        }, function (error) {
            console.error(error);
        });
    });
}

function alreadyExistsChecker(dbArray, prefRoom, date, startTime, endTime) {
    var dbArrayLocal = dbArray;
    var dateL = new Date(date.valueOf());
    var room = prefRoom;
    var x = 0;
    var foundMatch = false;
    while (x < ROOMNUMBERS.length && foundMatch == false) {
        var valueString = 'IVC Library - Room ' + ROOMNUMBERS[x] + ' ' + TIMES[startTime] + ' - ' + TIMES[startTime + 1] + ' ' + DAYS[dateL.getDay()] + ', ' + MONTHS[(dateL.getMonth())] + ' ' + dateL.getDate() + ', ' + dateL.getFullYear();;
        var matchTest = dbArrayLocal.indexOf(valueString);
        if (matchTest > -1) {
            foundMatch = true;
            return foundMatch;
        }
        x++;
    }
    return foundMatch;
}

function listenForNewRoomRequests() {
    console.log('Listening for new reserved rooms to handle...');

    var requests = admin.database().ref().child('groups').child('xX2SmBz9ftb').child('requested-new');

    requests.on('child_added', function (requestSnapshot) {

        console.log("Reservation Request Received!");
        var request = requestSnapshot.val();
        var keyN = requestSnapshot.key;

        processReservation(
            keyN,
            request.roomNumber,
            request.day,
            request.startTime,
            request.endTime,
            request.assignedUserID
        ).then(function () {
            console.log("Finished sending to reservation.");
            requestSnapshot.ref.remove();
        });

    }, function (error) {
        console.error(error);
    });
}

function processReservation(keyName, prefRoom, recurringDay, startTime, endTime, userUID) {
    return new Promise(function (resolve, reject) {
        //Create the date based on day.
        var dayOccurenceCount = 0;
        var date;
        var alternateRoom;

        //How many times in 2 weeks the day is available.
        //If it's the same day, it's available 3 times.
        if (Date.parse(DAYS[recurringDay]).equals(Date.today()) == true) {
            dayOccurenceCount = 3;
            date = Date.today();
        }
        else {
            dayOccurenceCount = 2;
            date = Date.parse('next ' + DAYS[recurringDay]);
        }

        for (var x = 0; x < dayOccurenceCount; x++) {
            //Checks all rooms for a match, if no match, then proceed.
            isReservedInDB(prefRoom, date, startTime, endTime).then(function (returnArray) {
                var isAlreadyDBRegistered = returnArray[0];
                var date = returnArray[1];

                if (isAlreadyDBRegistered == false) {
                    areTimesAvailable(prefRoom, date, startTime, endTime).then(function (timeAvailable) {
                        if (timeAvailable == true) {
                            registerDate(keyName, prefRoom, startTime, endTime, date, userUID);
                            resolve();
                        }
                        else {
                            var index = 0;
                            var foundRoomAvailable = false;
                            var pause = false;
                            while (index < ROOMNUMBERS.length && !foundRoomAvailable && pause == false) {
                                pause = true;
                                var lastIndex = index;
                                
                                areTimesAvailable(index, date, startTime, endTime).then(function (timeAvailable2) {
                                    if (timeAvailable2 == true) {
                                        foundRoomAvailable = true;
                                        //Set new room to register
                                        alternateRoom = index;
                                    }
                                    else {
                                        index++;
                                    }

                                    if (foundRoomAvailable == true) {
                                        if (alternateRoom === undefined)
                                            registerDate(keyName, prefRoom, startTime, endTime, date, userUID);
                                        else {
                                            registerDate(keyName, alternateRoom, startTime, endTime, date, userUID);
                                            alternateRoom = undefined;
                                        }
                                        resolve();
                                    }

                                    pause = false;
                                });
                                while (pause == true) {
                                    deasync.runLoopOnce();
                                }
                                console.log("After second thing");

                            }
                        }
                    });
                }
                else {
                    resolve();
                }
            });
            date = date.next().week();
        }
    });
}

function areTimesAvailable(prefRoom, date, startTime, endTime) {
    return new Promise(function (resolve, reject) {
        var room = prefRoom;
        var urlString = 'http://ivc.libcal.com/rooms_acc.php?gid=962&d=' + date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + '&cap=0';
        console.log(" ___ " + urlString);
        var dateL = new Date(date.valueOf());
        console.log("DAY: " + dateL.getDate());
        var goodToGo;


        require("jsdom").env(urlString, function (err, window) {
            if (err) {
                console.error(err);
                resolve(false);
                return false;
            }
            var $ = require("jquery")(window);
            $(window).ready(function () {

                //Not sure about <= or <.
                for (var x = startTime; x < endTime; x++) {
                    var valueString = '"IVC Library - Room ' + ROOMNUMBERS[room] + ' ' + TIMES[x] + ' - ' + TIMES[x + 1] + ' ' + DAYS[dateL.getDay()] + ', ' + MONTHS[(dateL.getMonth())] + ' ' + dateL.getDate() + ', ' + dateL.getFullYear() + '"';
                    console.log(room + " ___ " + valueString);
                    //Get the ID of the checkbox
                    var checkboxID = $("#roombookingform :input[value=" + valueString + "]").attr('id');
                    if (checkboxID === undefined) {
                        goodToGo = false;
                    }
                }
                console.log("TRUEEEEEEEEEEE");
                //Checking if undefined because if no check, any false would be true.
                //Could just put this as an else of the if...?
                if (goodToGo === undefined) {
                    goodToGo = true;
                }
                resolve(goodToGo);
            });
        });
    });
}

function registerDate(keyName, prefRoom, startTime, endTime, date, userUID) {
    var dateL = new Date(date.valueOf());
    var room = prefRoom;

    //getMonth() returns month - 1, so need to add 1 to keep standard. The array starts from 0 though, so that's okay for getting name
    var urlString = 'http://ivc.libcal.com/rooms_acc.php?gid=962&d=' + dateL.getFullYear() + '-' + (dateL.getMonth() + 1) + '-' + dateL.getDate() + '&cap=0';
    require("jsdom").env(urlString, function (err, window) {
        if (err) {
            console.error(err);
            return;
        }

        var $ = require("jquery")(window)

        $(window).ready(function () {
            for (var x = startTime; x < endTime; x++) {
                var valueString = '"IVC Library - Room ' + ROOMNUMBERS[room] + ' ' + TIMES[x] + ' - ' + TIMES[x + 1] + ' ' + DAYS[dateL.getDay()] + ', ' + MONTHS[(dateL.getMonth())] + ' ' + dateL.getDate() + ', ' + dateL.getFullYear() + '"';
                //Add to reserved list
                var dateTempString = MONTHS[(dateL.getMonth())] + ' ' + dateL.getDate() + ', ' + dateL.getFullYear() + ', ' + TIMESBANDAID[x];
                var dbDate = Date.parse(dateTempString);
                ref.child('groups').child('xX2SmBz9ftb').child('reserved').child(keyName).child(dbDate.valueOf()).set(valueString.slice(1, -1));
            
                //Get the ID of the checkbox
                var checkboxID = $("#roombookingform :input[value=" + valueString + "]").attr('id').substring(2);
                $("#roombookingform :checkbox[id=" + checkboxID + "]").prop('checked', true);
            }
            admin.database().ref().child('users').child(userUID).once('value', function (snapshot) {
                var request = snapshot.val();

                $('#roombookingform #fname').val(request.firstName);
                $('#roombookingform #lname').val(request.lastName);
                $('#roombookingform #email').val(request.schoolEmail);
                $('#roombookingform #q1').val("3");
                $('#roombookingform #q2').val(request.schoolUserID);

                $.post(
                    'process_roombookings.php?m=booking_mob',
                    $('#roombookingform').serialize());

            });
            console.log("Submitted");
        });

    });
}

function periodicReservationCheck() {
    var requests = admin.database().ref().child('groups').child('xX2SmBz9ftb').child('requested');

    var periodicCallback = requests.once('value', function (requestSnapshot) {
        console.log("Beginning periodical reservation check!");

        return requestSnapshot.forEach(function (childrenSnapshot) {
            var request = childrenSnapshot.val();
            var keyN = childrenSnapshot.key;
            processReservation(
                keyN,
                request.roomNumber,
                request.day,
                request.startTime,
                request.endTime,
                request.assignedUserID
            ).then(function () {});
            console.log("Periodical check done.");
        });
    }, function (error) {
        console.error(error);
        });
}

function notificationSystem() {
    var requests = admin.database().ref().child('groups').child('xX2SmBz9ftb').child('reserved');

    var notifications = requests.once('value', function (requestSnapshot) {
        console.log("Beginning notification system check!");
        var currentlyActive = false;
        var nextActive = false;
        var nextActiveMessage;

        requestSnapshot.forEach(function (mediumSnapshot) {
            mediumSnapshot.forEach(function (childrenSnapshot) {
                var request = childrenSnapshot.val();
                var keyN = childrenSnapshot.key;
                var now = getCurrentTimeByTimeZone();
                if ((Number(keyN) + 1800000) > now.valueOf() && now > Number(keyN))
                    currentlyActive = true;
                var timeDiff = (Number(keyN) - now.valueOf());
                if (timeDiff <= 900000 && timeDiff >= 0) {
                    nextActive = true;
                    nextActiveMessage = childrenSnapshot.val();
                }
            });
        });

        if (currentlyActive == false && nextActive == true) {
            console.log("Send Notification");
            var roomNumber = roomNameFromString(nextActiveMessage);
            var startTime = startTimeFromString(nextActiveMessage);

            request({
                url: 'https://fcm.googleapis.com/fcm/send',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': API_KEY
                },
                body: JSON.stringify({
                    notification: {
                        title: 'Room ' + roomNumber + ' Reservation',
                        body: 'Starts at ' + startTime + '.',
                        sound: 'default'
                    }, 
                    to: '/topics/group_xX2SmBz9ftb',
                    priority: 'high',
                    time_to_live: 7
                })
            }, function (error, response, body) {
                if (error) { console.error(error); }
                else if (response.statusCode >= 400) {
                    console.error('HTTP Error: ' + response.statusCode + ' - ' + response.statusMessage);
                    console.error('Text: ' + response);
                    console.error('Body: ' + body)
                }
                else {
                    console.log("Sent notification.");
                }
            });
        }

        console.log("Notification check done.");
    }, function (error) {
        console.error(error);
    });
}

//User check-in notification system.
function checkInNotificationSystemListener() {
    var requests = admin.database().ref().child('groups').child('xX2SmBz9ftb').child('user-checkin');

    console.log('Listening for new check-ins to handle...');

    requests.on('child_added', function (requestSnapshot) {

        console.log("Check-in Request Received!");
        var requestVal = requestSnapshot.val();
        var keyN = requestSnapshot.key;

        request({
            url: 'https://fcm.googleapis.com/fcm/send',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': API_KEY
            },
            body: JSON.stringify({
                notification: {
                    title: 'Study Room Check-in!',
                    body: requestVal.name + ' checked into room ' + requestVal.roomNumber + '.',
                    sound: 'default'
                },
                to: '/topics/group_xX2SmBz9ftb',
                priority: 'high',
                time_to_live: 7
            })
        }, function (error, response, body) {
            if (error) { console.error(error); }
            else if (response.statusCode >= 400) {
                console.error('HTTP Error: ' + response.statusCode + ' - ' + response.statusMessage);
                console.error('Text: ' + response);
                console.error('Body: ' + body)
            }
            else {
                console.log("Sent check-in notification.");
            }
            });
        requestSnapshot.ref.remove();
    });
}

function roomNameFromString(data) {
    var startingPoint = data.indexOf("Room");

    return data.substring(startingPoint + 5, startingPoint + 9);
}

function startTimeFromString(data) {
    var timeStartPoint = data.indexOf(roomNameFromString(data)) + 5;
    var timeEndPoint = data.indexOf("am") + 2;

    //Find end point
    if ((timeEndPoint - timeStartPoint - 2) < 0 || (timeEndPoint - timeStartPoint) > 9)
        timeEndPoint = data.indexOf("pm") + 2;

    return data.substring(timeStartPoint, timeEndPoint);
}

function addDays(daysAdd) {
    var dat = new Date(currentDate.valueOf() + daysAdd * 24 * 60 * 60 * 1000);
    return dat;
}

//Used in places where the server time zone is important such as for past event deletions and notifications.
function getCurrentTimeByTimeZone() {
    return Date.parse(new Date().toLocaleString("en-US", { timeZone: TIMEZONE })).valueOf();
}

// start listening
listenForNewRoomRequests();

checkInNotificationSystemListener();

//Check for past reservations. (60 seconds)
// setInterval(monitorPastTimeBlock, 60000);
monitorPastTimeBlock();

console.log("\n\nDate: " + getCurrentTimeByTimeZone());
var time = {hour:18, minute:15};
         
// console.log("Today: " + Date.today().first());
// console.log("Today2: " + Date.today().at(new Date()));


//Periodical reservation update check. (12 hours) 43200000
setInterval(periodicReservationCheck, 43200000);

setInterval(notificationSystem, 900000);

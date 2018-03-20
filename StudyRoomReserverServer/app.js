var admin = require('firebase-admin');
var request = require('request');
//var cheerio = require('cheerio');
var $ = require('jquery');
var jsdom = require("jsdom");
// require("./date.js");
var secretInfo = require("./secretKeys");
//var window = jsdom.jsdom().defaultView;

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
var currentDate = getCurrentTime();
console.log("Time: " + getCurrentTime());

// Fetch the service account key JSON file contents
var serviceAccount = require("./serviceAccountRoomRequest.json");

// Initialize the app with a service account, granting admin privileges
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: secretInfo.firebaseURL
});
ref = admin.database().ref();
//firebase.database.enableLogging(true);

//registerDate(0, 4, 5, regDate);

/* jsdom.jQueryify(window, "http://ivc.libcal.com/rooms_acc.php?gid=962&d=2017-02-10&cap=0", function () {
    var $ = window.$;

    if ($(":checkbox[value='IVC Library - Room 100E 8:00am - 8:30am Friday, February 10, 2017']").length > 0)
        console.log("Checkbox exists.");
});

request('http://ivc.libcal.com/rooms_acc.php?gid=962&d=2017-02-10&cap=0', function (error, response, html) {
    if (!error && response.statusCode == 200) {
//        var $ = cheerio.load(html);
//        $(":checkbox[value=4]").attr("checked", "true");


/*        $('span.comhead').each(function (i, element) {
            var a = $(this).prev();
            console.log(a.text());
        }); 
    } 
}); **/

function monitorPastTimeBlock() {
    console.log("BEFORE");
    ref.child('groups').child('xX2SmBz9ftb').child('reserved').once('value').then(function (snapshot) {
        console.log("Checking for past reservations...");
        snapshot.forEach(function (snapshotMain) {
            snapshotMain.forEach(function (snapshotEach) {
                //Remove if key is older time than current.
                var currentTimeDate = new Date();
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
        console.log("-----");

        console.log("____" + ref.child('groups').child('xX2SmBz9ftb').child('reserved'));

        admin.database().ref().child('groups').child('xX2SmBz9ftb').child('reserved').once('value').then(function (snapshot) {
            console.log("HEY");

            if (snapshot.exists() == false) {
                console.log("Gh");
                var resolveHolder = [false, dateL];
                resolve(resolveHolder);
                return;
            }

            snapshot.forEach(function (snapshotMain) {
                console.log("HEY");

                snapshotMain.forEach(function (snapshotEach) {
                    dbArrayResults.push(snapshotEach.val());
                    console.log(dbArrayResults);
                });
                console.log("Hey 2");
            });
            console.log("Hey 3");
            console.log("DATE TWO: " + dateL.getDate());
            var resolveHolder = [alreadyExistsChecker(dbArrayResults, room, dateL, startTime, endTime), dateL];
            resolve(resolveHolder);
        }, function (error) {
            console.error(error);
        });
        //while (exists === undefined) {
        //    require('deasync').runLoopOnce();
        //    console.log("Waiting........");
        //}
        //return exists;
        //    return false;
    });
}

function alreadyExistsChecker(dbArray, prefRoom, date, startTime, endTime) {
    var dbArrayLocal = dbArray;
    var dateL = new Date(date.valueOf());
    var room = prefRoom;
    var x = 0;
    var foundMatch = false;
    console.log("alreadyExistsChecker");
    while (x < ROOMNUMBERS.length && foundMatch == false) {
        var valueString = 'IVC Library - Room ' + ROOMNUMBERS[x] + ' ' + TIMES[startTime] + ' - ' + TIMES[startTime + 1] + ' ' + DAYS[dateL.getDay()] + ', ' + MONTHS[(dateL.getMonth())] + ' ' + dateL.getDate() + ', ' + dateL.getFullYear();
        console.log(valueString);
        console.log(dbArrayLocal);
        var matchTest = dbArrayLocal.indexOf(valueString);
        console.log(matchTest);
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
            console.log("Done.");
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
        console.log("S: " + startTime + " " + endTime);

        //How many times in 2 weeks the day is available.
        //If it's the same day, it's available 3 times.
        if (Date.parse(DAYS[recurringDay]).equals(Date.today()) == true) {
            console.log('TRUE');
            dayOccurenceCount = 3;
            date = Date.today();
        }
        else {
            dayOccurenceCount = 2;
            date = Date.parse('next ' + DAYS[recurringDay]);
        }

        console.log("FLAG 1");
        for (var x = 0; x < dayOccurenceCount; x++) {
            console.log('X: ' + x);
            console.log('dayOccurenceCount: ' + dayOccurenceCount);


            //Checks all rooms for a match, if no match, then proceed.
            isReservedInDB(prefRoom, date, startTime, endTime).then(function (returnArray) {
                var isAlreadyDBRegistered = returnArray[0];
                var date = returnArray[1];
                console.log("DATE ONE: " + date.getDate());
                //while (isAlreadyDBRegistered === undefined) {
                //    require('deasync').runLoopOnce();
                //    console.log("isAlreadyDBRegistered: " + isAlreadyDBRegistered);
                //}
                console.log('DATABASE ALREADY REGISTERED???????????????????????????? ' + isAlreadyDBRegistered);

                if (isAlreadyDBRegistered == false) {
                    areTimesAvailable(prefRoom, date, startTime, endTime).then(function (timeAvailable) {
                     //   var tempDate = new Date(date.valueOf());

                        //while (timeAvailable === undefined) {
                        //    require('deasync').runLoopOnce();
                        //    console.log(timeAvailable);

                        //    console.log("LOOP");
                        //}
                        if (timeAvailable == true) {
                            console.log("FLAG 3");
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
                                console.log("SADSADSADSAD");

                                console.log("We're in");
                                //while (isAlreadyDBRegistered2 === undefined) {
                                //    require('deasync').runLoopOnce();
                                //}

                                areTimesAvailable(index, date, startTime, endTime).then(function (timeAvailable2) {
                                    //while (timeAvailable2 === undefined) {
                                    //    require('deasync').runLoopOnce();
                                    //}
                                    console.log("----------");

                                    if (timeAvailable2 == true) {
                                        console.log("ROOM FOUND");
                                        foundRoomAvailable = true;
                                        //Set new room to register
                                        alternateRoom = index;
                                    }
                                    else {
                                        console.log("BEFORE INDEX: " + index);
                                        index++;
                                        console.log("AFTER INDEX: " + index);

                                    }

                                    if (foundRoomAvailable == true) {
                                        console.log("ROOM FOUND 2");
                                        if (alternateRoom === undefined)
                                            registerDate(keyName, prefRoom, startTime, endTime, date, userUID);
                                        else {
                                            registerDate(keyName, alternateRoom, startTime, endTime, date, userUID);
                                            alternateRoom = undefined;
                                        }
                                        resolve();
                                    }

                                    pause = false;
                                    console.log("After Pause");
                                });
                                while (pause == true) {
                                    require('deasync').runLoopOnce();
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
        console.log("FLAG 2");
        var room = prefRoom;
        var urlString = 'http://ivc.libcal.com/rooms_acc.php?gid=962&d=' + date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + '&cap=0';
        console.log(" ___ " + urlString);
        var dateL = new Date(date.valueOf());
        console.log("DAY: " + dateL.getDate());
        var goodToGo;


        require("jsdom").env(urlString, function (err, window) {
            console.log("Hi");

            if (err) {
                console.error(err);
                resolve(false);
                return false;
            }
            var $ = require("jquery")(window);
            console.log("Before ready");
            $(window).ready(function () {
                console.log("ready");

                //Not sure about <= or <.
                for (var x = startTime; x < endTime; x++) {
                    var valueString = '"IVC Library - Room ' + ROOMNUMBERS[room] + ' ' + TIMES[x] + ' - ' + TIMES[x + 1] + ' ' + DAYS[dateL.getDay()] + ', ' + MONTHS[(dateL.getMonth())] + ' ' + dateL.getDate() + ', ' + dateL.getFullYear() + '"';
                    console.log(room + " ___ " + valueString);
                    //Get the ID of the checkbox
                    var checkboxID = $("#roombookingform :input[value=" + valueString + "]").attr('id');
                    console.log("BOOM" + checkboxID);
                    if (checkboxID === undefined) {
                        console.log("FALSE");
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
        //while (goodToGo === undefined) {
        //    require('deasync').runLoopOnce();
        //    console.log("loop2");
        //}
        console.log("Hi");

    });
}

function registerDate(keyName, prefRoom, startTime, endTime, date, userUID) {
    console.log("FLAG 4");
    var dateL = new Date(date.valueOf());
    var room = prefRoom;

    console.log(currentDate.getMonth());
    //getMonth() returns month - 1, so need to add 1 to keep standard. The array starts from 0 though, so that's okay for getting name
    var urlString = 'http://ivc.libcal.com/rooms_acc.php?gid=962&d=' + dateL.getFullYear() + '-' + (dateL.getMonth() + 1) + '-' + dateL.getDate() + '&cap=0';
    console.log(urlString);
    require("jsdom").env(urlString, function (err, window) {
        if (err) {
            console.error(err);
            return;
        }

        var $ = require("jquery")(window)

        $(window).ready(function () {
            console.log("Hi");

            for (var x = startTime; x < endTime; x++) {
                var valueString = '"IVC Library - Room ' + ROOMNUMBERS[room] + ' ' + TIMES[x] + ' - ' + TIMES[x + 1] + ' ' + DAYS[dateL.getDay()] + ', ' + MONTHS[(dateL.getMonth())] + ' ' + dateL.getDate() + ', ' + dateL.getFullYear() + '"';
                //Add to reserved list
                var dateTempString = MONTHS[(dateL.getMonth())] + ' ' + dateL.getDate() + ', ' + dateL.getFullYear() + ', ' + TIMESBANDAID[x];
                console.log(dateTempString);
                var dbDate = Date.parse(dateTempString);
                console.log("_------------------------------------------------------------------_");
                console.log("VALUE: " + dbDate.valueOf());
                ref.child('groups').child('xX2SmBz9ftb').child('reserved').child(keyName).child(dbDate.valueOf()).set(valueString.slice(1, -1));
            
                console.log("REGISTERED: " + valueString);
                //Get the ID of the checkbox
                var checkboxID = $("#roombookingform :input[value=" + valueString + "]").attr('id').substring(2);
                console.log(checkboxID);
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
            console.log("keyN: " + keyN);
            processReservation(
                keyN,
                request.roomNumber,
                request.day,
                request.startTime,
                request.endTime,
                request.assignedUserID
            ).then(function () {
                //console.log("Done.");
                //console.log("Finished sending to reservation.");
                //requestSnapshot.ref.remove();
                });
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
                var now = new Date();
                console.log(keyN);
                if ((Number(keyN) + 1800000) > now.valueOf() && now > Number(keyN))
                    currentlyActive = true;
                console.log("NEXT: " + (Number(keyN) - now.valueOf()));
                var timeDiff = (Number(keyN) - now.valueOf());
                if (timeDiff <= 900000 && timeDiff >= 0) {
                    nextActive = true;
                    nextActiveMessage = childrenSnapshot.val();
                }
            });
        });
        console.log("BOO " + currentlyActive + " " + nextActive);

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

    console.log('Listening for new chek-ins to handle...');

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
    console.log("ADD_DATE: " + dat.getDate());
    return dat;
}

function getCurrentTime() {
    return new Date().toLocaleString("en-US", { timeZone: TIMEZONE });
}
//monitorPastTimeBlock();
//var hi = isReservedInDB(1, new Date(), 2, 3);

//if (hi === undefined)
//    console.log("NOTDONE---------------------------------------");
//else
//    console.log("DONE---------------------------------------");

//isReservedInDB(1, new Date(), 2, 3);

// start listening
listenForNewRoomRequests();
checkInNotificationSystemListener();
//isReservedInDB(1, new Date(), 2, 3);

//Check for past reservations. (60 seconds)
setInterval(monitorPastTimeBlock, 60000);

//Periodical reservation update check. (12 hours) 43200000
setInterval(periodicReservationCheck, 43200000);
//900000
setInterval(notificationSystem, 900000);

//console.log("---------------------------------------------------------------------------------------");
//isReservedInDB(1, new Date(), 2, 3);

/*******************************************
 Global ENV. Settings....
 ********************************************/
// These are "environmental settings" which are taken as "best guess" assumptions in an attempt to approximate the
// operation of a real-world elevator system....
const env = {
    // Physical Environment
    "cElevators": 2, // int
    "cFloors": 15, // int
    "iFloorHeight": 8, // int (height of each floor, in feet)
    // Elevator settings
    "iFpsTravelSpeed": 12, // int (feet per second)
    "cMaxRidersPerCar": 13, // int
    "cDoorOpenTime": 5, // int (seconds that a Car's doors will remain Open)
    "iMaintenanceCycle": 100, // int (# of trips a Car can make before its Maintenance cycle)
    // Rider settings
    "cNumOfSimulatedRiders": 100, // int
    "cMinRiderCreateInterval": 2, // seconds
    "cMaxRiderCreateInterval": 7 // seconds
};
// 'lazy' properties
env.iProcBeatsPerSecond = env.iFpsTravelSpeed; // one "beat" for each foot of travel
env.iProcTimerInterval = 1000 * (1 / env.iProcBeatsPerSecond); // micro-timer; used be each elevator interval/proc

/*******************************************
 SYSTEM Initialization
 ********************************************/
console.log(new Date() + ' ==> Environment Settings:');
console.log(JSON.stringify(env, null, 3));
const carriage = [];
const floor = [];

// counters
var i;

for (i = 1; i <= env.cFloors; i++) {
    floor[i] = new Floor(i);
}
for (i = 1; i <= env.cElevators; i++) {
    carriage[i] = new Carriage(i);
    carriage[i].start()
}

// create the (single) PeopleSimulator Object
const peopleSimulater = new PeopleSimulator();

console.log(new Date() + ' ==> System initialized');

/******************************* END OF INITIALIZATION ROUTINES *******************************************************/


/********************************************
 ELEVATOR CARRIAGE

 This is the CARRIAGE Class which is uniquely instantiated for each instance of an elevator (shaft). The number
 of these Objects created is dictated by the env variable "env.cElevators" which is an "indexed" array. (Ie, each
 elevator is inifitely identified by its index value -- "one-based")

 Constructor:
 idx = indexer value (int)
 riders = Array (of Rider objects)   **** stubbed in the event of deserialization/recovery

 NOTES:
 1) Each Carriage MUST keep track of its "trip" count (cTrip) which is determined by the following logic:
 A) whenever an elevator enters the IDLE state
 B) whenever an elevator changes directions (and travels the opposite direction)
 2) Each Carriage MUST enter the "maintenance" state whenever it has
 *********************************************/
function Carriage(idx, riders, location, state) {
    const inst = this;
    // Directions
    inst.up = 1;
    inst.down = 2;
    inst.dock = 3; // used to flag corner-case where an IDLE car is already on a Call-ing floor
    // movement "flags"
    inst.pickupDirection = 0; // when this Car is Called to a (F)loor. F above Car = UP, F below Car = Down
    inst.transitDirection = 0; // one of [up, down, 0]
    // General States
    inst.transit = 0; // Car is actively "Moving"
    inst.docked = 1; // Car is stationed on a floor and the doors are cycling
    inst.idle = 2; // Car is waiting for its next trip
    inst.maintenance = 3; // Car is in "out of service" mode and cannot be used
    inst.pickupCall = 4; // Car has been dispatched (from Idle) to fulfill a floor's pick-up Call
    inst.states = ["Transit", "Docked", "Idle", "Maintenance", "Pickup Call"]; // human-readable states for visual output
    inst.fxPointer = ["transit", "dock", "idle", "maintenance", "pickup"]; // used for method (function) "pointers"
    // Docked Actions (command constants)
    inst.da_DoLand = 1; // car is (now) at the correct floor (level)
    inst.da_OpenDoors = 2; // open the doors to the Car
    inst.da_OffloadRiders = 3; // offload any/all Riders terminating their trips on this floor
    inst.da_OnboardRiders = 4; // load Riders needing to travel in the same direction (as this car) up to MAX occupants
    inst.da_CloseDoors = 5; // close the doors to the Car
    inst.da_DockComplete = 6; // begin/continue transit to next floor-stop
    inst.dockedAction = 0; // this is action "indicator" for the above command-constants
    // localized
    inst.myID = idx; // self-identifier (indexer value)
    inst.state = state == undefined ? inst.idle : state; // set this Car's state value (defaults to 'idle')
    inst.riders = riders == undefined ? [] : riders; // initialized Riders array (if not passed in as Fx param)
    inst.iLastStop = undefined; // identifies the "last" floor (on this trip) needed by Rider ***currently*** aboard
    inst.iFirstStop = undefined; // dictates the first floor where Car will make a pick-up on (used with pickupCall)
    inst.procTimer = undefined; // reference handle for cancelling this Car's ProcTimer
    // inst.cTripFeetTravelled = 0; // counter for the number of feet travelled by this CAR on its current TRIP
    // inst.cFloorsPassed = 0; // floor counter (per problem Criteria)
    inst.bDoorsOpened = false; // flag that indicated whether (or not) the doors to this Car are Opened (or closed)
    inst.cBeatsTilDoorClose = 0; // this is a "counter" that tracks how many 'cycles' until the door needs to close
    // position properties
    inst.cTrips = 0; // TOTAL trip counter
    inst.cFloors = 0; // TOTAL floor counter
    inst.location = location == undefined ? 0 : location; // this is a "physical space" value (feet)
    inst.cFeet = 0; // keeps track of micro-value of feet travelled 0 (reset) or 1 to (Floor-Height)
    inst.cTotalFeetTravelled = 0; // the total number of feet travelled by this Car
    inst.iFloor = 1; // convenience; assume Cars start on floor #1 (TODO: deserialize from REDIS)

    // each elevator runs independently
    inst.start = function() {
        console.log("Car #" + inst.myID + " is now Running");

        // TODO: <stub> for deserialization of stored state-data after a soft failure'
        // ForNow: set all carriages to start running on the ground floor, with no passengers onBoard
        inst.procTimer = setInterval(inst.proc, env.iProcTimerInterval)
    };

    // the "processing engine" of each Car. This is where car-operation logic is contain. That logic dictates:
    //    + if it should advance in it's transit
    //    + if it should stop on a floor to "pick up" Rider(s) .. or, if the Car is already at Max capacity
    //    + if it should respond to a Call (Up/Down) initiated by any of the floor controls
    //    + how many floors the Car has travelled
    //    + if the car has reached the end of a "trip"
    //    + how many "trips" this Car has taken
    //    + if the Car should be decommissioned for purposes of service
    //    + if it needs to open/close its doors
    //    + its "state"
    inst.proc = function() {
        // branch based upon the state (ie, use an internal State-Machine to drive processing logic...)
        inst["do_" + inst.fxPointer[inst.state]](); // take advantage of JS's ability to route processing calls at runtime :)
    };

    // called when this Car is in the 'idle' state...
    inst.do_idle = function() {
        // IDLE Cars need to scan all of the Floors to see if there are any with a Call request. If so, the one
        // CLOSEST to the CALL needs to be triggered.
        // NOTE: Iteration starts at bottom floor (Floor #1 - which, for this emulator, we'll assume to be the ground
        //       since it would have the most foot-traffic (being the most humans will need to enter the building through
        //       the front-door (or parking/subway) entrances.
        var car;
        var closestCar = inst;
        var i, x;

        for (i = 1; i <= env.cFloors; i++) {
            // 1) Test for DOWN-call
            if (floor[i].bCallForDown) {
                console.log("[%d] discovered a Call on floor #%d", inst.myID, i);
                for (x = 1; x <= env.cElevators; x++) {
                    // cycle through all Cars to find the closest to the floor call...
                    car = carriage[x];
                    // verify the car is IDLE (this is only "available" state where the Car is guaranteed to be empty)
                    if ((car.state == car.idle) &&
                        ((floor[i].myFloorNumber - car.iFloor) < (floor[i].myFloorNumber - closestCar.iFloor))) {
                        closestCar = car;
                    }
                }
                closestCar.state = closestCar.pickupCall; // car will now be dispatched to pick up waiting Rider(s)
                closestCar.iFirstStop = i; // the NUMBER of the first pick-up floor
                closestCar.transitDirection = closestCar.down; // this is part of the DOWN-travel processing
                floor[i].bCallForDown = false;

                // indicate which direction this Car needs to travel in order to get to the Pick-up floor
                if (floor[i].myFloorNumber > closestCar.iFloor) {
                    closestCar.pickupDirection = closestCar.up;
                } else if (floor[i].myFloorNumber < closestCar.iFloor) {
                    closestCar.pickupDirection = closestCar.down;
                } else if (floor[i].myFloorNumber == closestCar.iFloor) {
                    // Car is already (idle-ing) on the same floor making the Pick-up call
                    closestCar.pickupDirection = closestCar.dock;
                } else {
                    console.log("!!!! Car #" + closestCar.myID + " pick-up direction could not be determined");
                    console.log("---> Car #" + closestCar.myID + " location is " + closestCar.location);
                    console.log("---> Floor #" + floor[i].myID + " location is " + floor[i].location);
                }
                console.log("[%d] has been sent for pick-up on floor #%d (transit = DOWN)", closestCar.myID, i);
            }
            // 2) Test for UP-call
            if (floor[i].bCallForUp) {
                console.log("[%d] discovered a Call on floor #%d", inst.myID, i);
                for (x = 1; x <= env.cElevators; x++) {
                    // cycle though all Cars to find the closest to the floor call...
                    car = carriage[x];
                    // verify the car is IDLE (this is only "available" state where the Car is guaranteed to be empty)
                    if ((car.state == car.idle) &&
                        ((floor[i].myFloorNumber - car.iFloor) < (floor[i].myFloorNumber - closestCar.iFloor))) {
                        closestCar = car;
                    }
                }
                closestCar.state = closestCar.pickupCall; // car will now be dispatched to pick up waiting Rider(s)
                closestCar.iFirstStop = i; // the NUMBER of the first pick-up floor
                closestCar.transitDirection = closestCar.up; // this is part of the DOWN-travel processing
                floor[i].bCallForUp = false;

                // indicate which direction this Car needs to travel in order to get to the Pick-up floor
                if (floor[i].myFloorNumber > closestCar.iFloor) {
                    closestCar.pickupDirection = closestCar.up;
                } else if (floor[i].myFloorNumber < closestCar.iFloor) {
                    closestCar.pickupDirection = closestCar.down;
                } else if (floor[i].myFloorNumber == closestCar.iFloor) {
                    // Car is already (idle-ing) on the same floor making the Pick-up call
                    closestCar.pickupDirection = closestCar.dock;
                } else {
                    console.log("!!!! Car #" + closestCar.myID + " pick-up direction could not be determined");
                    console.log("---> Car #" + closestCar.myID + " location is " + closestCar.location);
                    console.log("---> Floor #" + f.myID + " location is " + floor[i].location);
                }

                console.log("[%d] has been sent for pick-up on floor #%d (transit = UP)", closestCar.myID, i);
            }
        }
    };

    // "transit" mode is used to move the Car WITH riders aboard. (If the car is moving without riders, it should
    // be in "pickup" mode.
    inst.do_transit = function() {
        // branch based upon transit direction...
        if (inst.transitDirection == inst.up) {
            // car is going UP
            inst.location++;
            inst.cFeet++;
            inst.cTotalFeetTravelled++;

            if (inst.cFeet == env.iFloorHeight) {
                // car has moved UP one floor
                inst.cFloors++;
                inst.iFloor++;
                inst.cFeet = 0;

                console.log("[%d] entering floor #%d ", inst.myID, inst.iFloor);
                if ((floor[inst.iFloor].bCallForUp) || (inst.riders[0].destinationFloor == inst.iFloor)) {
                    inst.state = inst.docked;
                    inst.dockedAction = inst.da_DoLand;
                    console.log("[%d] docking on floor #%d ", inst.myID, inst.iFloor);
                }
            }
        } else if (inst.transitDirection == inst.down) {
            // car is going down
            inst.location--;
            inst.cFeet++;
            inst.cTotalFeetTravelled++;

            if (inst.cFeet == env.iFloorHeight) {
                // car has moved DOWN one floor
                inst.cFloors++;
                inst.iFloor--;
                inst.cFeet = 0;

                console.log("[%d] entering floor #%d ", inst.myID, inst.iFloor);
                if ((floor[inst.iFloor].bCallForDown) || (inst.riders[0].destinationFloor == inst.iFloor)) {
                    inst.state = inst.docked;
                    inst.dockedAction = inst.da_DoLand;
                    console.log("[%d] docking on floor #%d ", inst.myID, inst.iFloor);
                }
            }
        } else {
            console.log("[%d] is in TRANSIT mode, but the 'transitDirection' has not been set", inst.myID);
        }
    };

    inst.do_dock = function() {
        // process based upon "dockedAction" command-constant
        switch (inst.dockedAction) {
            case inst.da_DoLand:
                // NOTE: this stub is for future usage if needed (an "init" processing for the docking procedures)
                // goto next processing stage
                inst.dockedAction++;
                break;
            case inst.da_OpenDoors:
                if (inst.bDoorsOpened) {
                    // determine if this Car has waited long enough to transition to next processing step
                    if (inst.cBeatsTilDoorClose != 0) {
                        // decrease the delay counter
                        inst.cBeatsTilDoorClose--;
                    } else {
                        // goto next processing stage
                        inst.dockedAction++;
                    }
                } else {
                    // open the doors to this Car
                    inst.openDoors();
                }
                break;
            case inst.da_OffloadRiders:
                inst.offloadRiders();
                inst.dockedAction++;
                break;
            case inst.da_OnboardRiders:
                inst.onboardNewRiders();
                inst.dockedAction++;
                break;
            case inst.da_CloseDoors:
                inst.closeDoors();
                inst.dockedAction++;
                break;
            case inst.da_DockComplete:
                inst.doDockComplete();
                break;
            default:
            /// TODO: Houston, we have a problem...
        }
    };

    inst.doDockComplete = function() {
        // counter
        var x;
        var iLastSteop;

        // are there any riders still left in the Car?
        if (inst.riders.length == 0) {
            // all riders have left the Car...transition to IDLE state
            inst.state = inst.idle;
            inst.iFirstStop = undefined;
            inst.iLastStop = undefined;
            inst.pickupDirection = 0;
            inst.transitDirection = 0;
            inst.cTrips++;

            console.log("[%d] has completed trip #%d", inst.myID, inst.cTrips);
            console.log("[%d] has travelled %d floors since last maintenance", inst.myID, inst.cFloors);

            // if the Max-Trip threshold has been reached, but the Car into "Maintenance" mode, otherwise IDLE
            if (inst.cTrips == env.iMaintenanceCycle) {
                // this car has reached its Max number of trips; entering its Maintenance cycle
                inst.state = inst.maintenance;
                console.log("[%d] has switched to Maintenance mode", inst.myID);
            } else {
                inst.state = inst.idle;
                console.log("[%d] has switched to Idle mode", inst.myID);
            }
        } else {
            // Car still has riders aboard. Determine the "last stop" (of transit route) for current Riders
            if (inst.transitDirection == inst.up) {
                // find HIGHEST floor...
                inst.iLastStop = 0; // start benchmark-ing from the GROUND floor
                for (x = 0; x < inst.riders.length - 1; x++) {
                    if (inst.riders[x].destinationFloor > inst.iLastStop) {
                        inst.iLastStop = inst.riders[x].destinationFloor
                    }
                }
            } else {
                inst.iLastStop = env.cFloors; // start benchmark-ing from the TOP floor
                // fined LOWEST floor...
                for (x = 0; x < inst.riders.length - 1; x++) {
                    if (inst.riders[x].destinationFloor > inst.iLastStop) {
                        inst.iLastStop = inst.riders[x].destinationFloor
                    }
                }
            }
            inst.state = inst.transit;
            console.log("[%d] has switched to Transit mode", inst.myID);
        }
    };

    inst.offloadRiders = function() {
        // 'Remove' any/all Riders who are ending their transit on the Car's current floor
        var i;
        var cExit = 0;

        for (i = 0; i < inst.riders.length; i++) {
            if (inst.riders[i].destinationFloor == inst.iFloor) {
                // the currently indexed rider is ready to exit the Car
                console.log("-%d- has exited onto floor #%d", inst.riders[i].myID, inst.iFloor);
                inst.riders.splice(i, 1);
                cExit++;
            }
        }
        console.log("[%d] offloaded %d riders on floor #%d", inst.myID, cExit, inst.iFloor);
    };

    inst.onboardNewRiders = function() {
        var newRiders = [];
        var direction = "";
        var cNewRidersAllowed = env.cMaxRidersPerCar - inst.riders.length;
        var cAddedRiders = 0; // counter
        var goingUp = (inst.transitDirection == inst.up);

        console.log("[%d] adding new riders on floor #%d", inst.myID, inst.iFloor);
        if (goingUp) {
            direction = "UP";
            newRiders = floor[inst.iFloor].ridersGoingUp;
        } else {
            direction = "DOWN";
            newRiders = floor[inst.iFloor].ridersGoingDown;
        }
        console.log("[%d] has room for %d riders", inst.myID, cNewRidersAllowed);
        console.log(">%d< has %d rider(s) going %s", inst.iFloor, newRiders.length, direction);
        // does the car have room for all waiting riders?
        if (cNewRidersAllowed >= newRiders.length) {
            // all waiting riders can enter the the Car
            inst.riders = inst.riders.concat(newRiders);
            // remove the "added" riders from the floor's queue
            if (goingUp) {
                floor[inst.iFloor].ridersGoingUp = [];
            } else {
                floor[inst.iFloor].ridersGoingDown = [];
            }
            cAddedRiders = newRiders.length;
        } else {
            // only some of the waiting riders can enter the car at this time
            inst.riders = inst.riders.concat(newRiders.slice(0, cNewRidersAllowed - 1));

            newRiders.splice(0, cNewRidersAllowed - 1)
        }
        console.log("[%d] added %d riders", inst.myID, cAddedRiders);
    };

    inst.openDoors = function() {
        // open the doors
        inst.bDoorsOpened = true;
        // the Car needs to "wait" for a designated amount of time before it can start processing Rider(s)
        inst.cBeatsTilDoorClose = env.cDoorOpenTime * env.iProcBeatsPerSecond;
        // REPORT this Carriage has Opened its doors
        console.log("[%d] opened doors on floor #%d", inst.myID, inst.iFloor);
    };

    inst.closeDoors = function() {
        inst.bDoorsOpened = false;
        console.log("[%d] closed its doors on floor #%d", inst.myID, inst.iFloor);
        console.log("[%d] has %d rider(s) aboard", inst.myID, inst.riders.length);
        // whenever a car closes its doors, resort the riders aboard based upon their travel direction...
        if (inst.transitDirection == inst.up) {
            // because the Car is moving up, it will transit lower floors first...sort riders by ascending destinations
            inst.riders.sort(function(a, b) {
                return a - b
            });
        } else {
            // because the Car is moving Down, it wall transit higher floors first...sort rider by descending destinations
            inst.riders.sort(function(a, b) {
                return b - a
            });
        }
    };

    inst.do_maintenance = function() {
        console.log("[%d] is now in Maintenance mode", inst.myID);
    };

    // Used for an "empty" transit from IDLE position to a Call-ing floor
    // The Car will travel non-stop until is reaches its "pickup" floor level
    inst.do_pickup = function() {
        // determine if Car's location matches the Pick-up Floor location
        if (inst.iFloor == inst.iFirstStop) {
            // this Car is at its "pick-up" location
            inst.pickupDirection = inst.dock;
        }

        // determine which direction this Car needs to move in order to reach the Call-up floor...
        if (inst.pickupDirection == inst.up) {
            // move car UP
            inst.location++;
            inst.cFeet++;
            inst.cTotalFeetTravelled++;
            // check for Level-change
            if (inst.cFeet == env.iFloorHeight) {
                inst.cFloors++;
                inst.iFloor++; // Car has entered the next floor UP
                inst.cFeet = 0;

                console.log("[%d] entering floor #%d ", inst.myID, inst.iFloor);
            }
        } else if (inst.pickupDirection == inst.up) {
            // move car DOWN
            inst.location--;
            inst.cFeet++;
            inst.cTotalFeetTravelled++;
            // check for Level-change
            if (inst.cFeet == env.iFloorHeight) {
                inst.cFloors++;
                inst.iFloor--; // Car has entered next floor DOWN
                inst.cFeet = 0;

                console.log("[%d] entering floor #%d ", inst.myID, inst.iFloor);
            }
        } else if (inst.pickupDirection == inst.dock) {
            // car does not need to move; change its state to DOCK(ed)
            inst.state = inst.docked;
            // begin first step in the Docking process
            inst.dockedAction = inst.da_DoLand;

            console.log("[%d] docking on floor #%d ", inst.myID, inst.iFloor);
        }
    };
}

/********************************************
 PEOPLE Simulator

 This (singleton) is used to provide "human element" for the simulation. Based upon the environmental settings, it
 will "inject" a new rider into the system by:
 1) create a new Rider object
 2) placing him/her on a floor location (randomized)
 3) selecting a destination floor (other than the one they're currently located on)
 4) selecting the appropriate 'Call' action of the corresponding FloorControl (ie, UP or DOWN, depending on transit
 direction

 NOTE: A new Rider is created based upon a randomized timer-value (in seconds) that is between
 env.cMinRiderCreateInterval and env.cMaxRiderCreateInterval
 ********************************************/
function PeopleSimulator() {
    const activeRiders = []; // hanger for all (active) Rider objects
    var cRiders = 0; // counter that keeps track of the TOTAL number of Riders that have been created

    // check the "state" of the elevator
    console.log("PeopleSimulator is initializing");

    var createRider = function() {
        var iFloor; // records the floor this Rider is "inserted" on
        var iDestination; // records the floor this Rider will be travelling to

        do {
            iFloor = Math.floor((Math.random() * env.cFloors) + 1);
            iDestination = Math.floor((Math.random() * env.cFloors) + 1);
        }
        while (iFloor == iDestination); // kickout when iFloor and iDestination are different!
        cRiders++;
        activeRiders[cRiders] = new Rider(cRiders, iFloor, iDestination);

        // set timer to auto-create a new Rider based at the next (randomized) interval
        if (cRiders < env.cNumOfSimulatedRiders) {
            var rndDuration = Math.floor((Math.random() * (env.cMaxRiderCreateInterval - env.cMinRiderCreateInterval)) + 1);
            setTimeout(createRider, (env.cMinRiderCreateInterval + rndDuration) * 1000);
        }
    };
    // inject a reider into the simulator immediately upon startup...
    createRider();
}

/********************************************
 RIDER
 used to encapsulated Rider "objects"
 *********************************************/
function Rider(id, onBoardFloor, destinationFloor) {
    const me = this;
    var up = 1;
    var down = 2;
    var directionLabels = ["", "UP", "DOWN"];

    me.myID = id;
    me.onboardFloor = onBoardFloor;
    me.destinationFloor = destinationFloor;
    me.direction = onBoardFloor > destinationFloor ? down : up;

    // in order to save processing "overhead", we're going to move the logic of "processing" of New Rider
    // to the Floor Controller. (In other words, we'll turn the Floor Controller into a pseudo Concierge)
    floor[onBoardFloor].add(me);

    console.log("-%d- inserted on floor %s  ->  %d  << %s >>",
        id,
        onBoardFloor,
        destinationFloor,
        directionLabels[me.direction]);
}

/********************************************
 FLOOR CONTROLLER

 This Object is responsible for a couple of key elements:
 1) whenever the PeopleSimulator creates a new Rider it (the Rider) must be "injected" into the appropriate floor
 level. Hence, the Floor classes contains the Add() method.
 2) the Floor determines the direction of travel for new Riders and adds them to the appropriate queue (either
 ridersGoingDown[] or ridersGoingUp[], whichever the case might be
 3) when a new Rider is Add-ed on a floor, this control object determines if it (the given Floor), is when the
 transit route(s) for Carriages already on a "trip". If not, a flag is set that effectively causes the next "idle"
 Carriage to begin transit to the Floor for Rider pickup
 4) when a Carriage "docks" on a floor, it "transfers" the Rider(s) from the floor's queue to the Elevator's Queue.
 As part of the process, it calls the onBoard() method
 5) BEFORE a "docked" carriage can "onBoard" new Riders, it first must offLoad() any/all Riders whose destination is
 the Docked-floor; the offLoad() method is called for that process
 ********************************************/
function Floor(floorNumber) {
    const inst = this;

    inst.ridersGoingDown = []; // riders waiting onBoard process (Down)
    inst.ridersGoingUp = []; // riders waiting onBoard process (Up)
    inst.myFloorNumber = floorNumber; // Floors are one-based
    inst.location = (floorNumber - 1) * env.iFloorHeight; // convenience, so don's have to keep calculating
    inst.bCallForUp = false; // if an "UP" Rider on this floor is NOT within the active UP transit-streams
    inst.bCallForDown = false; // if a "DOWN" Rider on this flow is NOT within the active DOWN transit-streams
    inst.bShowUpArrow = false; // these are convenience hangers (future) visible-UI element manipulation
    inst.bShowDownArrow = false; //              ""

    // counters
    var x, i;
    var car;

    // check the "state" of the elevator
    console.log("Floor Object #" + floorNumber + " has been instantiated");

    inst.add = function(rider) {
        // console.log("Floor #" + inst.myFloorNumber + " has added Rider [" + rider.myID +"]");

        // add this rider to the appropriate "ridersWaiting" queue
        if (inst.myFloorNumber < rider.destinationFloor) {
            // this the UP processing...
            inst.ridersGoingUp.push(rider);

            // in order to avoid making redundant Car calls, we'll use the "Show Arrow" flags. When the direct-arrow
            // is active, no additional Car calls (for that that direction) will be allowed. The allow will stay
            // active until Car has completed its Docking process.
            if (!inst.bShowUpArrow) {
                // this is the first Rider on the floor to need an UP transit
                inst.bShowUpArrow = true;
                inst.bCallForUp = true;
            }

            // determine of this floor is WITHIN the active UP transit route
            for (i = 1; i <= env.cElevators; i++) {
                // evaluate the "ACTIVE" cars only
                car = carriage[i];
                if (((car == car.transit) || (car.state == car.docked)) && car.direction == car.up) {
                    // this Car is going UP...see if its transit crosses THIS floor. In order to do that, the car must
                    // currently be BELOW (or equal to) this floor (in HEIGHT), and it must have an "iLastStop" value that is
                    // greater-than OR equal to this floor number.
                    if ((car.location <= ((inst.myFloorNumber - 1) * env.iFloorHeight)) &&
                        (car.iLastStop >= inst.myFloorNumber)) {
                        inst.bCallForUp = false; // set "Call" flag to false -- this Floor is already on a transit route
                        console.log("Floor #" + inst.myFloorNumber + " is already in the UP transit route for Car #" + i);
                    }
                }
            }
        } else if (inst.myFloorNumber > rider.destinationFloor) {
            // this is the DOWN processing...
            inst.ridersGoingDown.push(rider);

            // in order to avoid making redundant Car calls, we'll use the "Show Arrow" flags. When the direct-arrow
            // is active, no additional Car calls (for that that direction) will be allowed. The allow will stay
            // active until Car has completed its Docking process.
            if (!inst.bShowDownArrow) {
                // this is the first Rider on the floor to need an UP transit
                inst.bShowDownArrow = true;
                inst.bCallForDown = true;
            }

            // determine of this floor is WITHIN the active UP transit-steams
            for (i = 1; i <= env.cElevators; i++) {
                // evaluate the "ACTIVE" cars only
                car = carriage[i];
                if (((car == car.transit) || (car.state == car.docked)) && car.direction == car.down) {
                    // this Car is going UP...see if its transit crosses THIS floor. In order to do that, the car must
                    // currently be BELOW (or equal to) this floor (in HEIGHT), and it must have an "iLastStop" value
                    // that is greater-than OR equal to this floor number.
                    if ((car.location >= ((inst.myFloorNumber - 1) * env.iFloorHeight)) &&
                        (car.iLastStop <= inst.myFloorNumber)) {
                        inst.bCallForDown = false; // set "Call" flag to false -- this Floor is already on a transit route
                        console.log("Floor #" + inst.myFloorNumber + " is already in the DOWN transit route for Car #" + i);
                    }
                }
            }
        }
    };
}

/*******************************************
      Global ENV. Settings....
********************************************/
  const redis = require("redis");                       // mandatory NPM package (Redis client)

// These are "environmental settings" which are taken as "best guess" assumptions in an attempt to approximate the
// operation of a real-world elevator system....
  const env = {
    // Physical Environment
      "cElevators": 4,                 // int
      "cFloors": 30,                    // int
      "iFloorHeight": 8,                // int (height of each floor, in feet)
    // Elevator settings
      "iFpsTravelSpeed": 3,             // int (feet per second)
      "cMaxRidersPerEle": 13,           // int
      "cOpenTimePerRider": 5,           // int (number of seconds doors remaining open for EACH Rider enter/exit-ing
      "cOpenTimeOverhead": 5,           // a "set" amount of time for door "mechanics" (independent of Rider count)
    // Rider settings
      "cNumOfSimulatedRiders": 100,     // int
      "cMinRiderCreateInterval": 3,     // seconds
      "cMaxRiderCreateInterval": 10     // seconds
  };


/**
 * REDIS
 *
 * Used for scalable PUB/SUB messaging and data persistence. We must assume that at some time the "controller"
 * logic (of the emulator) will experience a failure (such as a power outage), so REDIS affords a simple and
 * straightforward mechanism for state persistence between down-time episodes.
 *
 * NOTE:  This solution will probably not reach the point where persistence/deserialization is built, but at least the
 *        underlying capability is there if/when time allows.
**/
  const redisPort = 6379;                                 // assuming REDIS is running on the default port
  const redisIP = "127.0.0.1";                            // assuming " is running on local loopback interface
  const redisC = redis.createClient(redisPort, redisIP);  // the GLOBAL redisClient reference/object

/*******************************************
 SYSTEM Initialization

 TODO:  Since Redis is used to provide persistence as a state-machine, this sections would (time permitting) incorporate
        the procedural steps needed to re-initialize the system following a soft-failure.
 ********************************************/
  console.log(new Date() + ' ==> Environment Settings:');
  console.log(JSON.stringify(env, null, 3));
  const carriages = [];
  const floors = [];
  for (var i = 1; i <= env.cElevators; i++) {
    carriages[i] = new Carriage(i);
  }
  for (var i = 1; i <= env.cFloors; i++) {
    floors[i] = new FloorController(i);
  }

  // interval timer (to sync all processing actions...)
  // NOTE: in order to get 1-foot travel steps, we divide 1 (second) by the Carriage FPS -- this gives us
  //       the needed number of heartbeats (per second) needed to move a Carriage X feet during transit
  // reference to Timer is held in to order to Cancel it for clean shutdown
  var heartbeatTimer = setInterval(heartbeatProcessor, 1000 / env.iFpsTravelSpeed);

  // create the (single) PeopleSimulator Object
  var peopleSimulater = new PeopleSimulator();

  console.log(new Date() + ' ==> System initialized');

/******************************* END OF INITIALIZATION ROUTINES *******************************************************/


/*******************************************
 HELPER Functions
*******************************************/
function heartbeatProcessor() {
    console.log(new Date() + '[Heartbeat]');

    // every heartbeat will trigger the following:
    // + move carriages in transit
    // + determine which carriages need to stop (and let Riders exit)
    // + determine which floors have initiate a Carriage Call

    for (var i = 1; i <= env.cElevators; i++) {
        carriages[i].move();
    }
    ;
};


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

 ********************************************/
function Carriage(idx, riders, location, state) {
  const inst = this;
  inst.up = 1;
  inst.down = 2;
  inst.docked = 3;
  inst.maintenance = 4;
  inst.states = ["Up", "Down", "Docked", "Maintenance"];

  inst.myID = idx;                // self-identifier (indexer value)
  inst.cTrips = 0;                // trip counter
  inst.cFloors = 0;               // floor counter
  inst.state = state == undefined ? inst.docked : state // idle the carriage (if 'state' param is undefined)
  inst.location = location == undefined ? 0 : location // idle the carriage (if 'state' param is undefined)
  inst.maxLocation = (env.cFloors - 1) * env.iFloorHeight     // location will be based on the BOTTOM of the floor
  inst.riders = riders == undefined ? [] : riders             // init Riders array (if not passed in as param)

  inst.move = function() {
    // debugging output:
    // console.log("Carriage #" + inst.myID + " state is: " + states[inst.state - 1]); // offset for zero-based Array
    // check the "state" of the elevator
     switch(inst.state) {
         case inst.up:
           // carriage is on a Trip UP
           // not efficient, but easy to read...
           inst.location ++;

           break;


         case inst.down:
           // carriage is on a Trip down...
           inst.location --;
           break;
     }
  };

  inst.call = function(floor) {
    // TODO: test for undefined 'floor' value


  }

  inst.openDoors = function() {
    // REPORT this Carriage has Opened its doors
    // + let any ONBOARD Riders to exit the Carriage
    // + report the NUMBER of riders that have exited
    // + all NEW riders to enter the carriage
    // + report the NUMBER of new riders that have entered

  }

  inst.closeDoors = function() {
    // + determine if a TRIP has been completed (if so, test for MAINTENANCE mode)
    // + close the Carriage doors
    // + report the NEW total number of Riders in the Carriage
    // + re-valuate the STATE of the Carriage:
    //    IF riders == 0 -> IDLE, otherwise determine/continue travel
    // NOTE: STATE MUST transition to IDLE BEFORE it can be set to UP or DOWN


  }
};

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
  const activeRiders = [];         // hanger for all (active) Rider objects
  var cRiders = 0;                 // counter that keeps track of the TOTAL number of Riders that have been created

  // check the "state" of the elevator
  console.log("PeopleSimulator is initializing");

  var createRider = function() {
    var iFloor;                     // records the floor this Rider is "inserted" on
    var iDestination;               // records the floor this Rider will be travelling to

    do {
      iFloor = Math.floor((Math.random() * env.cFloors) + 1);
      iDestination = Math.floor((Math.random() * env.cFloors) + 1);
    }
    while (iFloor == iDestination);    // kickout when iFloor and iDestination are different!
    cRiders ++;
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

 used to encapsulated Rider elements
*********************************************/
function Rider(id, onBoardFloor, destinationFloor) {
  const me = this;
  me.myID = id;
  me.onboardFloor = onBoardFloor;
  me.desinationFloor = destinationFloor;

  console.log("New rider; onBoard(%s) --> destination(%d)", onBoardFloor, destinationFloor);

  // in order to save processing "overhead", we're going to move the logic of "processing" of New Rider
  // to the Floor Controller. (In other words, we'll turn the Floor Controller into a pseudo Concierge)
  floors[onBoardFloor].concierge(me)
}

/********************************************
 FLOOR CONTROLLER

 Each Floor has it's own Controller which governs which carriage will respond to the floor's Call action. This is
 determined by the simulation criteria:
 1) if a carriage is already there, it is utilized
 2) of not, the CLOSEST carriage will be called
 3) if there are more Riders than are allowed into the Carriage (after those exiting have been 'removed'), then
    ANOTHER carriage will be called to pick up remaining Riders (and this will continue until all are serviced)

 NOTES:
 1) A Controller MUST NEVER change the direction of a Carriage already transporting riders
 2) Controllers are responsilbe for OPEN-ing and CLOSE-ing the doors to the carriage when needed
 ********************************************/
function FloorController(floorNumber) {
    const inst = this;
    const off = 0;                                                   // const: indicates "call-state"
    const on = 1;                                                    // const: indicates "call-state"

    inst.ridersWaiting = [];                                        // for for riders waiting the onBoard process
    inst.dockedCarriages = [];                                      // Array holding carriages awaiting ingress/egress
    inst.myFloorNumber = floorNumber;                               // Floors start with #1
    inst.myFloorHeight = (floorNumber - 1) * env.iFloorHeight;      // Floor-height is measured zero-based
    inst.upCallState = off;
    inst.downCallState = off;

    // check the "state" of the elevator
    console.log("Floor Controller #" + floorNumber + " has been created");

    inst.concierge = function(rider) {
      // add this rider to the waiting queue
      ridersWaiting.push(rider);
      console.log("Floor Controller #" + inst.myFloorNumber + " has new Rider [" + rider.myID +"]");

      // Determine if the "Call" button has already been activated for the direction this Rider needs to travel...
      if (((inst.myFloorNumber < rider.desinationFloor) && !inst.upCallState) ||
         ((inst.myFloorNumber > rider.desinationFloor) && !inst.downCallState)) {
          // Rider needs to travel UP and the upCallState is OFF...CALL an elevator
          console.log("Floor Controller #" + inst.myFloorNumber + " has called carriage XXXX");
          callCarriage();
      }
    };

    var callCarriage = function() {
        // Carriage prioritization:
        // 1 - is a carriage ALREADY on that floor level?
        // 2 - is an OCCUPIED carriage going to transit PAST this floor?
        // 3 - which UNOCCUPIED carried is closest to this floor?

        // step # 1 -- determine if this floor already has a Carriage "docked"
        for(var i = 1; i <= env.cElevators; i++) {
            if ((carriages[i].state == carriages[i].docked) && (carriages[i].location == inst.myFloorHeight)) {
                console.log("Carriage #(%s) is DOCKED on Floor %f", i, inst.myFloorNumber);
            }

        }
    }
 }


// process.exit();


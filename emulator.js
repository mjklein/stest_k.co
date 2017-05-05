
/*******************************************
      Global ENV. Settings....
********************************************/
  const redis = require("redis");                       // mandatory NPM package (Redis client)


// These are "environmental settings" which are taken as "best guess" assumptions in an attempt to approximate the
// operation of a real-world elevator system....
  const env = {
    // Physical Environment
      "cElevators": 10,                 // int
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

  const redisPort = 6379;                               // assuming REDIS is running on the default port
  const redisIP = "127.0.0.1";                          // assuming " is running on local loopback interface
  const redisC = redis.createClient(redisPort, redisIP);  // the GLOBAL redisClient reference/object

/*******************************************
 SYSTEM Initialization

 TODO:  Since Redis is used to provide ppersitence as a state-machine, this sections would (time permitting) incorporate
        the procedural steps needed to re-initialize the system following a soft-failure.
 ********************************************/
  const carriages = [];
  for (var i = 1; i <= env.cElevators; i++) {
    carriages[i] = new Carriage(i);
  };

  // 1-second interval timer (to sync all processing actions...)
  var heartbeatTimer = setInterval(heartbeatProcessor, 1000);


  // visual feedback in Init-process completion
  console.log(new Date() + ' ==> Environment Settings:');
  console.log(JSON.stringify(env, null, 3));
  console.log(new Date() + ' ==> System initialized');


/*******************************************
 HELPER Functions
*******************************************/
function heartbeatProcessor() {
    console.log(new Date() + ' ==> System Heartbeat...');

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
  var inst = this;
  var up = 1;
  var down = 2;
  var idle = 3;
  var maintenance = 4;
  var states = ["Up", "Down", "Idle", "Maintenance"]


  inst.myID = idx;                // self-identifier (indexer value)
  inst.cTrip = 0;                 // trip counter
  inst.cFloor = 0;                // floor counter
  inst.state = state == undefined ? idle : state // idle the carriage (if 'state' param is undefined)
  inst.location = 0               // start at 0 ( => feet)
  inst.maxLocation = (env.cFloors - 1) * env.iFloorHeight     // location will be based on the BOTTOM of the floor

  inst.move = function() {
    // check the "state" of the elevator
    console.log("Carriage #" + inst.myID + " state is: " + states[inst.state - 1]); // offset for zero-based Array

     switch(inst.state) {
         case up:
           // carriage is on a Trip UP
           // not efficient, but easy to read...
           inst.location ++;

           break;


         case down:
           // carriage is on a Trip down...
           inst.location --;
           break;
     }
  };

  inst.call = function(floor) {
    // TODO: test for undefined 'floor' value


  }

  inst.openDoors = function() {
    // REPORT that this Carriage has Opened its doors
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


 ********************************************/
function PeopleSimulator() {

}

function Rider() {


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
 ********************************************/
function FloorController() {



}


// process.exit();


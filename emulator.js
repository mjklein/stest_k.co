
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
    // Elevator settings
      "iFpsTravelSpeed": 3,             // int (feet per second)
      "cMaxRidersPerEle": 13,           // int
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
    carriages[i] = new Carriage(i)
  };

  console.log(carriages[5].myID);









  // visual feedback in Init-process completion
  console.log(new Date() + ' ==> Environment Settings:');
  console.log(JSON.stringify(env, null, 3));
  console.log(new Date() + ' ==> System initialized');







/*******************************************
  ELEVATOR CARRIAGE

  This is the CARRIAGE Class which is uniquely instantiated for each instance of an elevator (shaft). The number
  of these Objects created is dictated by the env variable "env.cElevators" which is an "indexed" array. (Ie, each
  elevator is inifitely identified by its index value -- "one-based")

 Constructor:
  idx = indexer value (int)
  riders = Array (of Rider objects)   **** stubbed in the event of deserialization/recovery


 ********************************************/
function Carriage(idx, riders, location, direction) {
  var inst = this;

  inst.myID = idx;                  // self-identifier (indexer value)
  inst.cTrip = 0;                 // trip counter
  inst.cFloor = 0;                // floor counter


  return;
};











process.exit();


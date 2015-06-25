/*
 * This file explains how to use the "Action" class.
 * The "Action" class is the fundamental building block of the issue resolution system.
 * It is inspired by jQuery's "Promise" interface, which you should understand before using the "Action" class.
 *
 * The "Action" class represents a graph of actions (usually HTTP requests), and has three primary design goals:
 * + To provide meaningful status information (progress and actions completed) to the user
 * + To provide sufficient debugging information to the maintainer
 * + To provide a readable and extensible development platform to the developer
 */


// Here's how to create an action:
var my_action = new Action(
    'action title',
    // pass a list of promises that will be executed
    {
        fire: function() { // called by action.fire()
            return $.post(...);
        },
        description: function() { // optional: describe the actions that will be taken
            return [
                {
                    type: 'PM', // can put anything here, but types defined in action.js will produce prettier output
                    target: { username: 'Joe Bloggs', user_id: 12345 }
                },
                // ...
            ];
        },
        blockers: function() { // optional: list of things the user needs to do before fire() will succeed
            return [
                'please reverse the polarity of the neutron flow'
            ];
        }
    },
    // further promises will be executed in parallel:
    { ... },
    { ... },
    // ...
);

my_action.fire(bb);
my_action.fire(bb);


// "new Action" can also be called with an array:
var my_action = new Action([
    'my action',
    { ... },
    // ... list of arguments like above
]);

// To execute multiple actions in parallel, pass them to a container Action:
var  first_action = new Action(...);
var second_action = new Action(...);
var my_action = new Action(
    'wrapper action',
     first_action,
    second_action // both actions executed in parallel
);

// To execute multiple actions in serial, use then():
var action_1  = new Action(...);
var action_2a = new Action(...);
var action_2b = new Action(...);
action_1.then(action_2a); // action_2a() will be executed when action_1() completes
action_1.then(action_2b); // action_2b() will be executed when action_1() completes

// You can build more complex action graphs:
// To execute multiple actions in serial, use then():
var action_1  = new Action(...);
var action_2a = new Action(...);
var action_2b = new Action(...);
var action_3  = new Action(...);
action_1.then(
    new Action( 'action 2', action_2a, action_2b).then(action_3)
);

// To customise an Action, pass keys to fire():
var first_action = new Action(
    'first action',
    {
        fire: function(keys) {
            return $.post(keys.some_key).then(function(html) {
                // If an action returns a hash with a 'keys' value, those keys are passed to later actions:
                return { keys: { another_key: $(html).find('#myvalue').val() } };
            });
        }
    }
);
var second_action = new Action(
    'second action',
    {
        fire: function(keys) {
            // both 'some_key' and 'another_key' are available here:
            return $.post(keys.some_key + '&' + keys.another_key);
        }
    }
);

first_action.then(second_action);
first_action.fire(bb, { some_key: 'http://www.example.com/' });


// fire() returns a Promise that represents the entire graph of actions:
var  first_action = new Action(...);
var second_action = new Action(...);
first_action.then(second_action);
first_action.fire(bb)
    .progress(function(percent) {
        console.log( 'graph is ' + percent + '% complete' );
    })
    .done(function(completed_promises) {
        // 'completed_promises' is similar to the 'promises' array above, but with the following extra attributes:
        // + promise - jQuery Promise object returned by fire()
        // + result - 'success' or 'fail'
        // + start_time - Date object specifying when the promise was fired
        // +   end_time - Date object specifying when the request completed
        console.log( 'first_action and second_action are both complete, having run the following promises: ', completed_promises );
    })
    .fail(function(completed_promises) {
        console.log( 'one or more of the promises failed.  If one of the first_action promises failed, second_action will not have fired.' );
    });


// For actions large enough to need an audit trail, consider using fire_with_journal() to build one:
first_action.fire_with_journal(
    bb,
    { some_key: 'http://www.example.com/' },
    v,
    12345, // journal thread ID
    'my namespace',
    'my action name',
    [ other_bb1, other_bb2 ] // other BulletinBoard objects used by actions - all given a sanity check before the action starts
);

# Testing flow

## Connect and close tests

TEST-01
-- PORT 8200 --
- The client will connect and then close the connection - server needs to emit close event

TEST-02
-- PORT 8201 --
- The client will connect and then the server will close the connection - client needs to report the close event


### Client receives event and method call
TEST-03
-- PORT 8202 --
Client is be able to receive event `test3-receiving-event` with the data `{greeting: "hi! I am websocket server"}`

TEST-04
-- PORT 8203 --
Client is be able to receive event `test4-receiving-method-call` with the data `{ask: "client, how are you?"}` and then it needs to answer by `{answer: "I am fine."}`

### Client emit event and method call
TEST-05
-- PORT 8204 --
Client emits `test2-emit-event` with the data `{greeting: "hi! I am websocket client"}`

TEST-06
-- PORT 8205 --
- Client calls the method `test2-call-method` with the data `{ask: "server, how are you?"}` and then it will receive the result `{answer: "I am super!"}`



### Massive event and method call

TEST-07
-- PORT 8206 --
- At the same time, the client and server will both emit 100 events and method calls as bellow

- Event
  - Client
    - event-client1 {greeting: "hello from client for event-client1"}
    - event-client2  {greeting: "hello from client for event-client2"}
    - ...
    - event-client100  {greeting: "hello from client for event-client100"}

  - Server
    - event-server1  {greeting: "hello from client for event-server1"}
    - event-server2 {greeting: "hello from client for event-server2"}
    - ...
    - event-server100 {greeting: "hello from client for event-server100"}

- Method call
  - From client:
    - Client: call-client1 {ask: "From call-client1, how are you?"}
    - Server: {answer: "For call-client1, I am so so}
    - We loop this 100 times with increasing client<number> and random delay on server's answer

  - From server:
    - Server: call-server1 {ask: "From call-server1, how are you?"}
    - Client: {answer: "For call-server1, I am so so}
    - We loop this 100 times with  increasing server<number> and random delay on client's answer

## Test2

TEST-08
-- PORT 8207 --

- The client will emit the event "test2" to start the test

- To test if the client can auto-reconnect and both sides can keep the data

- Redo the `Massive event and method call` with randomly closing the connection.
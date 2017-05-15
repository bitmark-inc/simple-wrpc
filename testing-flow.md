# Testing flow

## Connect and close tests

TEST-01
-- PORT 8201 --
- The client will connect and then close the connection - server needs to emit close event

TEST-02
-- PORT 8202 --
- The client will connect and then the server will close the connection - client needs to report the close event


### Client receives event and method call
TEST-03
-- PORT 8203 --
Client is be able to receive event `test3-server-event` with the data `{greeting: "hi! I am websocket server"}`

TEST-04
-- PORT 8204 --
Client is be able to receive event `test4-server-call` with the data `{ask: "client, how are you?"}` and then it needs to answer by `{answer: "I am fine."}`

### Client emit event and method call
TEST-05
-- PORT 8205 --
Client emits `test5-client-event` with the data `{greeting: "hi! I am websocket client"}`

TEST-06
-- PORT 8206 --
- Client calls the method `test6-client-call` with the data `{ask: "server, how are you?"}` and then it will receive the result `{answer: "I am super!"}`

TEST-07
-- PORT 8207 --
- Client calls the method `test7-client-call-with-disruption` with the data `{ask: "server, how are you?"}` and then disconnect to the server. It should auto reconnect and will receive the result `{answer: "I am super!"}`

TEST-08
-- PORT 8208 --
- Server calls the method `test7-server-call-with-disruption` with the data `{ask: "client, how are you?"}` and then disconnect to the server. The should receive the result `{answer: "I am super!"}` after the client reconnect.

### Massive event and method call

TEST-09
-- PORT 8209 --
- At the same time, the client and server will both emit 100 events and method calls as bellow

- Event
  - Client
    - test9-client-event-1 {greeting: "hello from client for client-event-1"}
    - test9-client-event-2  {greeting: "hello from client for client-event-2"}
    - ...
    - test9-client-event-100  {greeting: "hello from client for client-event-100"}

  - Server
    - test9-server-event-1  {greeting: "hello from client for server-event-1"}
    - test9-server-event-2 {greeting: "hello from client for server-event-2"}
    - ...
    - test9-server-event-100 {greeting: "hello from client for server-event-100"}

- Method call
  - From client:
    - Client: test9-client-call-1 {ask: "From client-call-1, how are you?"}
    - Server: {answer: "For client-call-1, I am so so.}
    - We loop this 100 times with increasing client-<number> and random delay on server's answer

  - From server:
    - Server: test9-server-call-1 {ask: "From server-call-1, how are you?"}
    - Client: {answer: "For server-call-1, I am so so}
    - We loop this 100 times with  increasing server-<number> and random delay on client's answer

## Test2

TEST-010
-- PORT 8210 --

- To test if the client can auto-reconnect and both sides can keep the data

- Redo the `Massive event and method call` (TEST-09) with randomly closing the connection.
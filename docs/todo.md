- [ ] Make daemon testable
    - special CLI flag in daemon so it can run next to existing daemon with its own socket and own daemon-test.log file
    - tests can write to test socket in ~/.claude-notify/
    - Unsure if there's a better idea?
    - Special commands to open/close control window via socket?
    - snap-happy to take screenshots? better way to test UI?
- [ ] If the control window has focus, pressing escape should close it
- [ ] Need to add an icon which we can use for system notifications (if available on the platform)
- [ ] Sometimes, Claude sends a message, I get a system notification that shows it, then I get another notification that says "Claude is waiting for your input". Control window also shows that. Needs fixing to only show the original last message. Getting this in the ~/.claude-notify/log.txt for that scenario. I think we also need to improve the logging to log.txt, so we have a better idea what message was sent.
    [2025-07-06T22:48:44.888Z] Hook Stop: pid=76293, ppid=70450, sessionId=dde8d6e6-40d3-49ea-bdbd-8c2c9ad99484
    [2025-07-06T22:48:44.941Z] Daemon is already running
    [2025-07-06T22:48:44.942Z] Connected to daemon
    [2025-07-06T22:48:44.942Z] Message sent to daemon
    [2025-07-06T22:48:51.053Z] Hook Notification: pid=76313, ppid=70450, sessionId=dde8d6e6-40d3-49ea-bdbd-8c2c9ad99484
    [2025-07-06T22:48:51.104Z] Daemon is already running
    [2025-07-06T22:48:51.105Z] Connected to daemon
    [2025-07-06T22:48:51.105Z] Message sent to daemon
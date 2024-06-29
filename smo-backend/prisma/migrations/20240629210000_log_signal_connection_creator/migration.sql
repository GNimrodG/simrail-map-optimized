ALTER TABLE
    signals
ADD
    creator VARCHAR(40);

ALTER TABLE
    signal_connections
ADD
    creator VARCHAR(40);

ALTER TABLE
    signal_connections
ADD
    vmax integer;

ALTER TABLE
    signal_connection_errors
ADD
    creator VARCHAR(40);

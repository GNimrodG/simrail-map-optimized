ALTER TABLE signals
    ADD role VARCHAR(20);

ALTER TABLE signals
    ADD prev_finalized BOOLEAN DEFAULT false NOT NULL;

ALTER TABLE signals
    ADD next_finalized BOOLEAN DEFAULT false NOT NULL;

CREATE FUNCTION get_signal_distance(signal1 CHARACTER VARYING, signal2 CHARACTER VARYING) RETURNS DOUBLE PRECISION
    LANGUAGE plpgsql
AS
$$
DECLARE
    point1   GEOMETRY;
    point2   GEOMETRY;
    distance DOUBLE PRECISION;
BEGIN
    SELECT point INTO point1 FROM signals WHERE name = signal1;
    SELECT point INTO point2 FROM signals WHERE name = signal2;
    distance := ST_DistanceSphere(point1, point2);
    RETURN distance;
END;
$$;

CREATE FUNCTION set_signal_distance_before_insert() RETURNS trigger
    LANGUAGE plpgsql
AS
$$
BEGIN
    NEW.distance = get_signal_distance(NEW.prev, NEW.next);
    RETURN NEW;
END;
$$;

CREATE TABLE
    signal_connections
(
    prev VARCHAR(12) NOT NULL
        CONSTRAINT signal_connections_signals_prev_name_fk
            REFERENCES signals
            ON UPDATE cascade ON DELETE cascade,
    next VARCHAR(12) NOT NULL
        CONSTRAINT signal_connections_signals_next_name_fk
            REFERENCES signals
            ON UPDATE cascade ON DELETE cascade,
    distance   DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT signal_connections_pk PRIMARY KEY (prev, next)
);

CREATE TRIGGER set_prev_signal_distance_before_insert
    BEFORE INSERT
    ON signal_connections
    FOR EACH ROW
EXECUTE PROCEDURE set_signal_distance_before_insert();

create table signal_connection_errors
(
    prev    VARCHAR(12)           not null,
    next    VARCHAR(12)           not null,
    error   VARCHAR(500)          not null,
    checked boolean default false not null,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    constraint signal_connection_errors_pk
        primary key (prev, next, error)
);

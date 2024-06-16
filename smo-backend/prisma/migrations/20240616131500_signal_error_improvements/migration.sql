CREATE OR REPLACE FUNCTION get_signal_distance(signal1 CHARACTER VARYING, signal2 CHARACTER VARYING) RETURNS DOUBLE PRECISION
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

    IF point1 IS NULL OR point2 IS NULL THEN
        RETURN -1;
    END IF;

    distance := ST_DistanceSphere(point1, point2);
    RETURN distance;
END;
$$;

ALTER TABLE signal_connection_errors
    ADD distance DOUBLE PRECISION NOT NULL DEFAULT -1;

CREATE FUNCTION set_signal_error_distance_before_insert() RETURNS trigger
    LANGUAGE plpgsql
AS
$$
BEGIN
    NEW.distance = get_signal_distance(NEW.prev, NEW.next);
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_signal_error_distance_before_insert
    BEFORE INSERT
    ON signal_connection_errors
    FOR EACH ROW
EXECUTE PROCEDURE set_signal_error_distance_before_insert();

UPDATE signal_connection_errors
SET distance = get_signal_distance(prev, next)
WHERE distance = -1;

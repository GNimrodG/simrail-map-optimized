UPDATE
    signals
SET
    point = ST_MakePoint(ST_Y(point), ST_X(point));

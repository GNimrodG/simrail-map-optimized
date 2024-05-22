create table
    public.signals (
        name varchar(12) primary key not null,
        point geometry (Point, 4326) not null,
        extra varchar(255) not null,
        accuracy float not null,
        type varchar(10),
        created_at timestamp default CURRENT_TIMESTAMP not null
    );

create index signals_point_index on public.signals using gist (point);

create table
    public.prev_signals (
        signal varchar(12) not null,
        prev_signal varchar(12) not null,
        created_at timestamp default CURRENT_TIMESTAMP not null,
        PRIMARY KEY (signal, prev_signal),
        FOREIGN KEY (signal) REFERENCES public.signals (name) ON DELETE CASCADE,
        FOREIGN KEY (prev_signal) REFERENCES public.signals (name) ON DELETE CASCADE
    );

create table
    public.next_signals (
        signal varchar(12) not null,
        next_signal varchar(12) not null,
        created_at timestamp default CURRENT_TIMESTAMP not null,
        PRIMARY KEY (signal, next_signal),
        FOREIGN KEY (signal) REFERENCES public.signals (name) ON DELETE CASCADE,
        FOREIGN KEY (next_signal) REFERENCES public.signals (name) ON DELETE CASCADE
    );

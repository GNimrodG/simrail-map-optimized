create table
    public.stats (
        created_at timestamp default CURRENT_TIMESTAMP not null,
        service_id varchar(12) not null,
        duration integer not null,
        count integer not null,
        server_count integer,
        PRIMARY KEY (service_id, created_at)
    );

create index service_id_index on public.stats (service_id);

create index created_at_index on public.stats (created_at);

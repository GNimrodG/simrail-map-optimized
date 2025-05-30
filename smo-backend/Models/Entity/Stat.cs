﻿using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SMOBackend.Models.Entity;

[Table("stats")]
[PrimaryKey(nameof(ServiceId), nameof(CreatedAt))]
internal class Stat(string serviceId, int duration, int count, int? serverCount)
{
    [MaxLength(20)]
    public string ServiceId { get; set; } = serviceId;

    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public int Duration { get; set; } = duration;

    public int Count { get; set; } = count;

    public int? ServerCount { get; set; } = serverCount;
}
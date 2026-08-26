using System;
using System.Collections.Generic;

namespace Billing.ViewModels
{
    public class AdminUserRow
    {
        public string Id { get; set; }
        public string Email { get; set; }
        public string Role { get; set; }
        public DateTime CreatedOn { get; set; }
        public string ApprovedBy { get; set; }
        public DateTime? ApprovedOn { get; set; }
    }

    public class AdminIndexViewModel
    {
        public List<AdminUserRow> Users { get; set; } = new List<AdminUserRow>();
        public string Message { get; set; }
        public string Error { get; set; }
    }
}

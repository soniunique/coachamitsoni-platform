Preservation note for admin navigation rollback.

Current main before rollback: 439af8840a502e1d42f88092df3e1f4fadbf974f
Current LearnShell.tsx blob: 5a47475e59b8d4d092717a488b17f84722e4bf0a

The admin navigation redesign began at e0b8e7cb68c8c7644de78020d23797cf0f2c816f. The pre-redesign LearnShell.tsx is preserved at commit 59a2b0e71a697f6917970ccf1d2149f7917f9ea5.

This rollback intentionally changes only src/components/learn/LearnShell.tsx back to the pre-navigation-redesign version. Other current fixes remain on main, including later assessment/certificate and feedback changes.

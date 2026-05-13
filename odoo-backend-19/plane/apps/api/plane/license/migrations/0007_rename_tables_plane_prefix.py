"""
Rename all model tables to plane_<original>_table prefix.

Part of the unified-DB-with-Odoo plan: prevents future name collisions when
Plane and Odoo schemas live in the same Postgres database per tenant.
"""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("license", "0006_instance_is_current_version_deprecated"),
    ]

    operations = [
        migrations.AlterModelTable(
            name="instance",
            table="plane_instances",
        ),
        migrations.AlterModelTable(
            name="instanceadmin",
            table="plane_instance_admins",
        ),
        migrations.AlterModelTable(
            name="instanceconfiguration",
            table="plane_instance_configurations",
        ),
        migrations.AlterModelTable(
            name="changelog",
            table="plane_changelogs",
        ),
    ]

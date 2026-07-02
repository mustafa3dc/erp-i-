import os
import sys
import traceback

# Add backend to path so 'app' module can be loaded
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, "backend")
sys.path.insert(0, backend_dir)

try:
    from app.report_generator import generate_daily_report_pdf
    print("Import successful! Generating PDF...")
    generate_daily_report_pdf("test_output.pdf")
    print("PDF generated successfully!")
except Exception as e:
    print("ERROR DURING GENERATION:")
    traceback.print_exc()

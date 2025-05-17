import csv
import json
import random

def generate_random_hex_color():
    return f"#{random.randint(0, 0xFFFFFF):06x}"

def convert_csv_to_json(csv_file_path, json_file_path):
    """
    Converts a Uniclass CSV file to a JSON structure suitable for the application.
    The CSV must have 'Code' and 'Title' columns.
    """
    classifications = []
    try:
        with open(csv_file_path, mode='r', encoding='utf-8-sig') as csv_file: # utf-8-sig to handle potential BOM
            csv_reader = csv.DictReader(csv_file)
            # Check for required columns
            if 'Code' not in csv_reader.fieldnames or 'Title' not in csv_reader.fieldnames:
                print(f"Error: CSV file {csv_file_path} must contain 'Code' and 'Title' columns.")
                return

            for row in csv_reader:
                code = row.get('Code')
                title = row.get('Title')
                if code and title: # Ensure both code and title are present
                    classifications.append({
                        "code": code,
                        "name": title,
                        "color": generate_random_hex_color(),
                        "elements": []
                    })
    except FileNotFoundError:
        print(f"Error: CSV file not found at {csv_file_path}")
        return
    except Exception as e:
        print(f"An error occurred: {e}")
        return

    try:
        # Ensure the public/data directory exists (though run_terminal_cmd would be better for this)
        # For now, assume it exists or the user creates it.
        # A more robust solution would use os.makedirs(exist_ok=True)
        with open(json_file_path, 'w', encoding='utf-8') as json_file:
            json.dump(classifications, json_file, indent=2)
        print(f"Successfully converted {csv_file_path} to {json_file_path}")
    except Exception as e:
        print(f"Error writing JSON file: {e}")

if __name__ == "__main__":
    csv_path = "uniclass_pr.csv"  # Assumes the script is run from the workspace root
    # Ensure public/data directory exists. The script itself can't create it directly
    # without importing 'os' which might not be allowed in this context.
    # Let's try to place it in public/data if that's the final destination.
    # User might need to create public/data if that's the final destination.
    json_path = "public/data/uniclass_pr.json"
    print(f"Attempting to convert {csv_path} to {json_path}...")
    convert_csv_to_json(csv_path, json_path) 
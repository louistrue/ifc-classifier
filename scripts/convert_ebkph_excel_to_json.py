import pandas as pd
import json
import random
import os

def generate_random_hex_color():
    return f"#{random.randint(0, 0xFFFFFF):06x}"

def convert_ebkph_excel_to_json(excel_file_path, json_file_path, sheet_name_or_index=1):
    """
    Converts the eBKP-H Excel data (from the specified sheet) to a JSON structure.
    It filters for "Level 3" items and uses "Code" and "Elementbezeichnung_DE" columns.
    """
    classifications = []
    try:
        # Read the specified sheet (0-indexed for sheet_name=None, so 1 for the second sheet)
        df = pd.read_excel(excel_file_path, sheet_name=sheet_name_or_index, header=0)
        
        print(f"Successfully read Excel file. Columns found: {df.columns.tolist()}")

        # Verify required columns exist
        required_columns = ['Level', 'Code', 'Elementbezeichnung_DE']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            print(f"Error: Missing required columns in Excel sheet: {', '.join(missing_columns)}")
            print(f"Please ensure the sheet has '{required_columns[0]}', '{required_columns[1]}', and '{required_columns[2]}' columns.")
            return

        for index, row in df.iterrows():
            # Check if 'Level' is 3 (lowest level)
            level = row['Level']
            is_level_3 = False
            if pd.notna(level):
                if isinstance(level, (int, float)) and int(level) == 3:
                    is_level_3 = True
                elif isinstance(level, str) and level.strip() == '3':
                    is_level_3 = True
            
            if is_level_3:
                code = row['Code']
                name = row['Elementbezeichnung_DE']
                
                if pd.notna(code) and pd.notna(name):
                    classifications.append({
                        "code": str(code).strip(),
                        "name": str(name).strip(),
                        "color": generate_random_hex_color(),
                        "elements": []
                    })
                else:
                    print(f"Skipping row {index+2} due to missing Code or Elementbezeichnung_DE.")
            # else:
            #     print(f"Skipping row {index+2} (Level: {level}) because it's not Level 3.")

        print(f"Processed {len(df)} rows. Found {len(classifications)} Level 3 classification items.")

    except FileNotFoundError:
        print(f"Error: Excel file not found at {excel_file_path}")
        return
    except Exception as e:
        print(f"An error occurred while reading or processing the Excel file: {e}")
        return

    try:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(json_file_path), exist_ok=True)
        
        with open(json_file_path, 'w', encoding='utf-8') as json_file:
            json.dump(classifications, json_file, indent=2, ensure_ascii=False)
        print(f"Successfully converted and saved data to {json_file_path}")
        if not classifications:
            print("Warning: No Level 3 classifications were extracted. The JSON file will be empty or contain an empty list.")

    except Exception as e:
        print(f"Error writing JSON file: {e}")

if __name__ == "__main__":
    # IMPORTANT: Place your Excel file in the same directory as this script,
    # or provide the full path to the Excel file.
    excel_file = "public/data/ebkp.xlsx"
    json_output_file = "public/data/ebkph.json"

    print(f"Starting conversion of '{excel_file}' (Sheet 2) to '{json_output_file}'...")
    # Assuming the relevant data is in the second sheet (index 1)
    convert_ebkph_excel_to_json(excel_file, json_output_file, sheet_name_or_index=1) 
from flask import Flask, render_template, request, jsonify, send_file
import pandas as pd
import os
from io import BytesIO
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
ALLOWED_EXTENSIONS = {'xlsx', 'xls', 'csv'}


def allowed_file(filename):
    """Check if the file has an allowed extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')


@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file upload and process Excel/CSV files."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        try:
            # Secure the filename
            filename = secure_filename(file.filename)
            filename_lower = filename.lower()
            
            # Read the file based on extension
            if filename_lower.endswith('.xlsx') or filename_lower.endswith('.xls'):
                df = pd.read_excel(file)
            elif filename_lower.endswith('.csv'):
                df = pd.read_csv(file)
            else:
                return jsonify({'error': 'Unsupported file format. Please upload Excel or CSV files.'}), 400
            
            # Get basic info about the dataframe
            info = {
                'filename': filename,
                'rows': len(df),
                'columns': len(df.columns),
                'column_names': df.columns.tolist(),
                'preview': df.head(10).to_dict(orient='records')
            }
            
            return jsonify(info)
        
        except Exception as e:
            return jsonify({'error': f'Error processing file: {str(e)}'}), 500
    
    return jsonify({'error': 'File type not allowed. Please upload Excel or CSV files.'}), 400


@app.route('/api/process', methods=['POST'])
def process_data():
    """Process data based on user requirements."""
    try:
        data = request.json
        operation = data.get('operation')
        
        # Example operations
        if operation == 'summary':
            return jsonify({
                'message': 'Summary operation completed',
                'result': 'Data summary calculated successfully'
            })
        
        return jsonify({'message': 'Operation completed successfully'})
    
    except Exception as e:
        return jsonify({'error': f'Error processing data: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

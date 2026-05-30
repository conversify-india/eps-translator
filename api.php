<?php
/**
 * Secure API Proxy for EPS Translator
 * Handles requests to CloudConvert and Google Sheets without exposing keys to the client.
 */

// Enable CORS for frontend integration
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json");

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// ── Secure Constants (Kept safe on the server) ──
define('CLOUDCONVERT_API_KEY', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiY2NlMzQyZWY2M2RhMDBhYjg2MDBlYzViNzIyMWE0NWVhMGI3Yzk1ZGUwMjdiNDYxZmVkZjNhYzM5MjUwYjJlZTVlZDdiYWI5NGQ3NGY5YTAiLCJpYXQiOjE3Nzk5Njg5NzIuNzI5NDUxLCJuYmYiOjE3Nzk5Njg5NzIuNzI5NDUzLCJleHAiOjQ5MzU2NDI1NzIuNzIyMTQ4LCJzdWIiOiI3NTc0OTA4OCIsInNjb3BlcyI6WyJ0YXNrLnJlYWQiLCJ0YXNrLndyaXRlIl19.rCk2YXwVABtGLTOEK0xf0U3dDVprj2zljSQFAcvhJ0V8aGUuIuDHi9xj1IWKpexWwYtSfxXUS7MwvvnnHJfEnvEBjsO38YiRr9_sfwRxq7nRxS7WaMq_hPDzJMc2dFWM_KytFJAxHv54sm_HVo4oYzGYfBgyb-n48xDRlOP10YkC4JQedX9oio1igNCWkNEFnHjBtBBzaspG-fx2pIqQrlUZjaW3MK95YVlFKy5XByO4VTTeBNx3N4mVBiL88ZGf-8zA62FoHp5vDz3YkODaXdTy6Suj-zMdeUGQssruaVQWbqiYXefqPZdsFi4_y--h5335m1RBGmdrEEs07pi5F1mJVLbgl19zSKEyH17ZaLYSNSrCj9gF-6vJs-6_qAbpFeN4-mCD5vaFm7VkCKhGAo6fRDWYapGjhjyFEYTwvDLJDq4tJVEhjkcl7qP5JE4hYHR6M3P09FfEhAo3S0KzTv3qRsWNjXd-_kGESH_SB7zIRxeNtRzXDvBXxNX3D1jvTm-UK79QGSYIbovjlAPmRVNQa0FFLs75ZFhdfWh7R9Vsu1z34Jymrn_rBWlz8nWBZL75NYYvyVmpTX_cSJeAfSUKECTGHtLuQq1dwkuB-z8H6m3hWCmKo6R0i3d-O9d_GQCKfNxcfBsVvhg6F74fj2eRFY_2uui3gwMlTM3UrhA');
define('GOOGLE_SHEETS_URL', 'https://script.google.com/macros/s/AKfycbwNmYFt1K-lEx5HUcDUgwp7_5_9FzjfldfW0L-P6CyXqb7DER2z0YtCJWzyGv6rywl_Ig/exec');

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'create-job':
        // Retrieve JSON input from frontend
        $inputData = file_get_contents('php://input');
        
        $ch = curl_init('https://api.cloudconvert.com/v2/jobs');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $inputData);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . CLOUDCONVERT_API_KEY,
            'Content-Type: application/json'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        http_response_code($httpCode);
        echo $response;
        break;

    case 'check-status':
        $jobId = isset($_GET['id']) ? preg_replace('/[^a-zA-Z0-9\-]/', '', $_GET['id']) : '';
        if (empty($jobId)) {
            http_response_code(400);
            echo json_encode(['error' => 'Job ID is required']);
            exit;
        }

        $ch = curl_init('https://api.cloudconvert.com/v2/jobs/' . $jobId);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . CLOUDCONVERT_API_KEY
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        http_response_code($httpCode);
        echo $response;
        break;

    case 'log-login':
        $inputData = file_get_contents('php://input');
        
        $ch = curl_init(GOOGLE_SHEETS_URL);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $inputData);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true); // Google Apps Script uses redirects
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        http_response_code($httpCode);
        echo $response;
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        break;
}

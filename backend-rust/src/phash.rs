use image::DynamicImage;

pub fn phash(img: &DynamicImage) -> i64 {
    use image::imageops::FilterType;

    let resized = img
        .resize_exact(32, 32, FilterType::Lanczos3)
        .into_luma8();

    let pixels: Vec<f64> = resized.pixels().map(|p| p[0] as f64).collect();
    let dct = dct2d(&pixels, 32);

    // Top-left 8×8 of the DCT output (64 coefficients)
    let mut features: Vec<f64> = Vec::with_capacity(64);
    for y in 0..8usize {
        for x in 0..8usize {
            features.push(dct[y * 32 + x]);
        }
    }

    // Mean of all coefficients except DC (index 0)
    let mean: f64 = features[1..].iter().sum::<f64>() / (features.len() - 1) as f64;

    let mut hash: i64 = 0;
    for (i, &val) in features.iter().enumerate() {
        if val > mean {
            hash |= 1i64 << i;
        }
    }
    hash
}

fn dct1d(input: &[f64]) -> Vec<f64> {
    let n = input.len();
    let mut output = vec![0f64; n];
    for k in 0..n {
        output[k] = input
            .iter()
            .enumerate()
            .map(|(i, &x)| {
                x * (std::f64::consts::PI * k as f64 * (2 * i + 1) as f64 / (2 * n) as f64).cos()
            })
            .sum();
    }
    output
}

fn dct2d(pixels: &[f64], size: usize) -> Vec<f64> {
    // DCT along rows
    let mut row_dct = vec![0f64; size * size];
    for row in 0..size {
        let transformed = dct1d(&pixels[row * size..(row + 1) * size]);
        row_dct[row * size..(row + 1) * size].copy_from_slice(&transformed);
    }
    // DCT along columns
    let mut result = vec![0f64; size * size];
    for col in 0..size {
        let col_data: Vec<f64> = (0..size).map(|row| row_dct[row * size + col]).collect();
        let transformed = dct1d(&col_data);
        for row in 0..size {
            result[row * size + col] = transformed[row];
        }
    }
    result
}

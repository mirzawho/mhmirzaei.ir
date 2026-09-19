/// <reference types="astro/client" />

declare namespace App {
    interface Locals {
        // Define the shape of your 'json' property here
        json: Record<string, any>;
    }
}
